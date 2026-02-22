"use client";

interface CenterControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const CenterControls = ({
  isPlaying,
  isLoading,
  hasError,
  onTogglePlay,
  onPrev,
  onNext,
}: CenterControlsProps) => (
  <div className="absolute inset-0 flex items-center justify-center z-30">
    <div className="flex items-center justify-center gap-x-6 sm:gap-x-12">
      <button
        onClick={onPrev}
        className="flex items-center justify-center text-white p-2 sm:p-3 rounded-full bg-black/40 backdrop-blur-xl hover:bg-black/60 transition-all duration-200 transform hover:scale-105 active:scale-95 border border-white/10 shadow-lg"
        aria-label="Skip backward"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 sm:w-12 sm:h-12"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.3249 7.82403C10.5848 7.94892 10.75 8.2117 10.75 8.50001V15.5C10.75 15.9142 10.4142 16.25 10 16.25C9.58581 16.25 9.25003 15.9142 9.25003 15.5V10.0605L7.96855 11.0857C7.6451 11.3444 7.17313 11.292 6.91438 10.9685C6.65562 10.6451 6.70806 10.1731 7.03151 9.91436L9.53151 7.91436C9.75663 7.73425 10.0651 7.69914 10.3249 7.82403Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M14.25 9.25001C13.6977 9.25001 13.25 9.69772 13.25 10.25V13.75C13.25 14.3023 13.6977 14.75 14.25 14.75C14.8023 14.75 15.25 14.3023 15.25 13.75V10.25C15.25 9.69772 14.8023 9.25001 14.25 9.25001ZM11.75 10.25C11.75 8.8693 12.8693 7.75001 14.25 7.75001C15.6307 7.75001 16.75 8.8693 16.75 10.25V13.75C16.75 15.1307 15.6307 16.25 14.25 16.25C12.8693 16.25 11.75 15.1307 11.75 13.75V10.25Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11.324 1.67511C11.4489 1.41526 11.7117 1.25 12 1.25C12.7353 1.25 13.4541 1.32394 14.1492 1.46503C19.0563 2.46112 22.75 6.79837 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12C1.25 7.59065 3.90459 3.80298 7.69972 2.14482C8.07929 1.97898 8.52143 2.15224 8.68726 2.53181C8.8531 2.91137 8.67984 3.35351 8.30028 3.51935C5.03179 4.94742 2.75 8.20808 2.75 12C2.75 17.1086 6.89137 21.25 12 21.25C17.1086 21.25 21.25 17.1086 21.25 12C21.25 7.84953 18.5158 4.33622 14.75 3.16544V4.5C14.75 4.81852 14.5488 5.10229 14.2483 5.20772C13.9477 5.31315 13.6133 5.21724 13.4143 4.96852L11.4143 2.46852C11.2342 2.24339 11.1991 1.93496 11.324 1.67511Z"
          />
        </svg>
      </button>

      <button
        onClick={onTogglePlay}
        disabled={isLoading || hasError}
        className="flex items-center justify-center text-white p-2 sm:p-3 rounded-full bg-black/40 backdrop-blur-xl transition-all duration-200 transform hover:scale-110 active:scale-95 border border-white/10 shadow-lg"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : isPlaying ? (
          <svg
            stroke="currentColor"
            fill="currentColor"
            strokeWidth="0"
            viewBox="0 0 320 512"
            className="w-6 h-6 sm:w-12 sm:h-12"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"></path>
          </svg>
        ) : (
          <svg
            stroke="currentColor"
            fill="currentColor"
            strokeWidth="0"
            viewBox="0 0 384 512"
            className="w-6 h-6 sm:w-12 sm:h-12"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"></path>
          </svg>
        )}
      </button>

      <button
        onClick={onNext}
        className="flex items-center justify-center text-white p-2 sm:p-3 rounded-full bg-black/40 backdrop-blur-xl hover:bg-black/60 transition-all duration-200 transform hover:scale-105 active:scale-95 border border-white/10 shadow-lg"
        aria-label="Skip forward"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 sm:w-12 sm:h-12"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.3249 7.82403C10.5848 7.94892 10.75 8.2117 10.75 8.50001V15.5C10.75 15.9142 10.4142 16.25 10 16.25C9.58581 16.25 9.25003 15.9142 9.25003 15.5V10.0605L7.96855 11.0857C7.6451 11.3444 7.17313 11.292 6.91438 10.9685C6.65562 10.6451 6.70806 10.1731 7.03151 9.91436L9.53151 7.91436C9.75663 7.73425 10.0651 7.69914 10.3249 7.82403Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M14.25 9.25001C13.6977 9.25001 13.25 9.69772 13.25 10.25V13.75C13.25 14.3023 13.6977 14.75 14.25 14.75C14.8023 14.75 15.25 14.3023 15.25 13.75V10.25C15.25 9.69772 14.8023 9.25001 14.25 9.25001ZM11.75 10.25C11.75 8.8693 12.8693 7.75001 14.25 7.75001C15.6307 7.75001 16.75 8.8693 16.75 10.25V13.75C16.75 15.1307 15.6307 16.25 14.25 16.25C12.8693 16.25 11.75 15.1307 11.75 13.75V10.25Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12.676 1.67511C12.5511 1.41526 12.2883 1.25 12 1.25C11.2647 1.25 10.5459 1.32394 9.8508 1.46503C4.94367 2.46112 1.25 6.79837 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 7.59065 20.0954 3.80298 16.3003 2.14482C15.9207 1.97898 15.4786 2.15224 15.3127 2.53181C15.1469 2.91137 15.3202 3.35351 15.6997 3.51935C18.9682 4.94742 21.25 8.20808 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12C2.75 7.84953 5.48421 4.33622 9.25 3.16544V4.5C9.25 4.81852 9.45118 5.10229 9.75175 5.20772C10.0523 5.31315 10.3867 5.21724 10.5857 4.96852L12.5857 2.46852C12.7658 2.24339 12.8009 1.93496 12.676 1.67511Z"
          />
        </svg>
      </button>
    </div>
  </div>
);
