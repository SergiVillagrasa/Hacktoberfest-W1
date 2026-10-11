interface PlayButtonProps {
  onPlay: () => void;
  label: string;
  replay?: boolean;
}

export function PlayButton({ onPlay, label, replay }: PlayButtonProps) {
  return (
    <button type="button" className="chunky chunky-secondary chunky-sm" onClick={onPlay}>
      {replay ? `Replay ${label}` : `Play ${label}`}
    </button>
  );
}
