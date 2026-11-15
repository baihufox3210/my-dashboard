import { coverImageStyle } from '../features/blog/media'

type CoverImageProps = {
  src: string
  position?: string
  scale?: number
  className?: string
  lazy?: boolean
}

// Every cover (cards, readers, editor previews) is drawn by this one component in a
// wide 7:2 frame, so a crop set in the adjust dialog looks the same wherever it appears.
function CoverImage({ src, position, scale, className, lazy = true }: CoverImageProps) {
  return <span className={`cover-frame${className ? ` ${className}` : ''}`}>
    <img className="cover-image" src={src} alt="" draggable={false} loading={lazy ? 'lazy' : undefined} decoding="async" style={coverImageStyle({ coverImagePosition: position, coverImageScale: scale })} />
  </span>
}

export default CoverImage
