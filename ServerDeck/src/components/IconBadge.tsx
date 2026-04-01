type IconBadgeProps = {
  symbol?: string;
};

export function IconBadge({ symbol = "▦" }: IconBadgeProps) {
  return <div className="icon-badge">{symbol}</div>;
}
