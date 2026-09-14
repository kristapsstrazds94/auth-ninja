import Image from "next/image";

type DemoLogoProps = {
  variant?: "nav" | "hero";
  showWordmark?: boolean;
  /** Use CSS wordmark with light text — for dark console backgrounds */
  tone?: "light" | "dark";
};

export function DemoLogo({
  variant = "nav",
  showWordmark = true,
  tone = "light",
}: DemoLogoProps) {
  if (variant === "hero" && tone === "dark") {
    return (
      <div className="demo-logo demo-logo-hero demo-logo-dark">
        <Image
          className="demo-logo-image demo-logo-image-hero"
          src="/logo.png"
          alt=""
          width={88}
          height={88}
          aria-hidden
          priority
          fetchPriority="high"
        />
        <p className="demo-logo-wordmark demo-logo-wordmark-dark">
          <span className="demo-logo-wordmark-light">Auth</span>
          <span className="demo-logo-wordmark-accent">Ninja</span>
        </p>
      </div>
    );
  }

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
          fetchPriority="high"
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
