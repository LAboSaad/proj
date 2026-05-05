
interface CaptureFlashProps {
  active: boolean;
}

export function CaptureFlash({ active }: CaptureFlashProps) {
  return (
    <div
      style={{
        position:     "absolute",
        inset:        0,
        background:   "white",
        borderRadius: "inherit",
        pointerEvents:"none",
        opacity:      active ? 0.75 : 0,
        transition:   active ? "opacity 0s" : "opacity 0.4s ease-out",
        zIndex:       20,
      }}
    />
  );
}