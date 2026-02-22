use std::sync::Arc;
use tokio::sync::Mutex;
use rusqlite::{Connection, Result, params};
use std::path::PathBuf;
use super::migrations::Migrator;
use crate::models::{Playlist, Video, DownloadHistoryItem, DownloadTask};

pub struct DatabasePool {
    connections: Arc<Mutex<Vec<Connection>>>,
    db_path: PathBuf,
    max_connections: usize,
}

impl DatabasePool {
    pub fn new(db_path: &PathBuf, max_connections: usize) -> Result<Self> {
        // Run migrations first
        Migrator::migrate(db_path)?;
        
        let pool = DatabasePool {
            connections: Arc::new(Mutex::new(Vec::with_capacity(max_connections))),
            db_path: db_path.clone(),
            max_connections,
        };
        
        // Pre-warm one connection
        let _ = pool.get_connection()?;
        
        Ok(pool)
    }

    pub async fn get_connection(&self) -> Result<Connection> {
        let mut connections = self.connections.lock().await;
        
        // Try to reuse existing connection
        if let Some(mut conn) = connections.pop() {
            // Check if connection is still valid
            if conn.execute("SELECT 1", []).is_ok() {
                return Ok(conn);
            }
        }
        
        // Create new connection
        self.create_connection()
    }

    pub async fn return_connection(&self, conn: Connection) {
        let mut connections = self.connections.lock().await;
        if connections.len() < self.max_connections {
            connections.push(conn);
        }
        // If pool is full, connection will be dropped (closed)
    }

    fn create_connection(&self) -> Result<Connection> {
        let conn = Connection::open(&self.db_path)?;
        
        // Optimize for app usage
        conn.pragma_update(None, "journal_mode", &"WAL")?;
        conn.pragma_update(None, "synchronous", &"NORMAL")?;
        conn.pragma_update(None, "cache_size", &-20000)?; // 20MB cache
        conn.pragma_update(None, "temp_store", &"MEMORY")?;
        conn.pragma_update(None, "mmap_size", &268435456)?; // 256MB memory map
        
        // Enable foreign key constraints
        conn.pragma_update(None, "foreign_keys", &"ON")?;
        
        // Set busy timeout for app responsiveness
        conn.busy_timeout(std::time::Duration::from_secs(30))?;
        
        Ok(conn)
    }

    pub async fn execute_with_connection<F, R>(&self, f: F) -> Result<R>
    where
        F: FnOnce(&Connection) -> Result<R> + Send + 'static,
        R: Send + 'static,
    {
        let conn = self.get_connection().await?;
        let result = f(&conn);
        self.return_connection(conn).await;
        result
    }
}

// Macro for easier database operations
macro_rules! with_db {
    ($pool:expr, $conn:ident => $body:block) => {
        $pool.execute_with_connection(|$conn| $body).await
    };
}

pub use with_db;
