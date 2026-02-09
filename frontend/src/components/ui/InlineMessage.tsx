export default function InlineMessage({ children, tone = 'error' }: { children: string; tone?: 'error' | 'success' | 'info' }) {
  return <div className={`inline-message message-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}
