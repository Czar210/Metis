import { Send } from 'lucide-react'

type ChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
}

export function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="flex items-end gap-2 bg-metis-surface border border-metis-border rounded-2xl p-2">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="Pergunte para a Metis... (Enter para enviar)"
        className="flex-1 bg-transparent text-sm text-metis-text placeholder-metis-muted outline-none resize-none py-1.5 px-2 max-h-32 disabled:opacity-50"
        style={{ lineHeight: '1.5' }}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 w-9 h-9 rounded-xl bg-metis-accent hover:bg-metis-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        <Send className="w-4 h-4 text-white" />
      </button>
    </div>
  )
}
