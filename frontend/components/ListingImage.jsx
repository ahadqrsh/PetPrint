// Plain <img>: images come from Cloudinary or this server's /uploads, and
// next/image would need remotePatterns configured for both. Falls back to a
// species glyph on a paper panel when there's no photo.
export default function ListingImage({ src, alt, species, className = "" }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />
    );
  }

  return (
    <div
      className={`flex items-center justify-center border-b border-line bg-paper ${className}`}
      aria-label={`No photo of ${alt}`}
      role="img"
    >
      <span className="font-display text-3xl text-ink-faint">
        {species === "cat" ? "Cat" : "Dog"}
      </span>
    </div>
  );
}
