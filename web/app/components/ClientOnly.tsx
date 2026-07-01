import { useEffect, useState, type ReactNode } from "react";

/**
 * react-three-fiber's <Canvas> touches window/document as soon as it mounts.
 * Under SSR (React Router renders on the server first), that first pass has
 * no window/document, so the canvas silently fails to render or the whole
 * subtree errors out during hydration. Rendering it only after the component
 * has mounted on the client sidesteps that entirely.
 */
export default function ClientOnly({
  children,
  fallback = null,
}: {
  children: () => ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children()}</>;
}
