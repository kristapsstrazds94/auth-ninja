import Image from "next/image";

type DemoLogoProps = {
  variant?: "nav" | "hero";
  showWordmark?: boolean;
};

export function DemoLogo({ variant = "nav", showWordmark = true }: DemoLogoProps) {
  if (variant === "hero") {
    return (
      <div className={`demo-logo demo-logo-${variant}`}>
        <Image
          className="demo-logo-image demo-logo-image-hero"
          src="/logo-full.png"
          alt="Auth-Ninja"
          width={280}
          height={280}
          priority
        />
      </div>
    );
  }

  const iconSize = 36;

  return (
    <div className={`demo-logo demo-logo-${variant}`}>
      <Image
        className="demo-logo-image"
        src="/logo.png"
        alt=""
        width={iconSize}
        height={iconSize}
        aria-hidden
      />
      {showWordmark ? <span className="demo-logo-wordmark">Auth-Ninja</span> : null}
    </div>
  );
}
