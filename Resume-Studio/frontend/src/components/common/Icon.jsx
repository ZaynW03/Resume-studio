import * as Icons from 'lucide-react'

function toPascal(name) {
  return (name || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
}

export default function Icon({ name, size = 16, className = '' }) {
  const Cmp = Icons[toPascal(name)] || Icons.Circle
  return <Cmp size={size} className={className} />
}

export const ICON_CHOICES = [
  'user', 'file-text', 'graduation-cap', 'briefcase', 'folder-git-2',
  'wrench', 'award', 'code', 'languages', 'heart', 'star',
  'map-pin', 'phone', 'mail', 'globe', 'github', 'linkedin',
  'book-open', 'trophy', 'lightbulb', 'rocket', 'circle',
]
