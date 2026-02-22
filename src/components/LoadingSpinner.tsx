import { RefreshCw } from "lucide-react"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
}

export const LoadingSpinner = ({ size = "md", text, className }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 animate-fadeIn ${className || ""}`}>
      <RefreshCw className={`${sizeClasses[size]} animate-spin text-primary`} />
      {text && <span className={`${textSizeClasses[size]} text-muted-foreground font-medium`}>{text}</span>}
    </div>
  )
}
