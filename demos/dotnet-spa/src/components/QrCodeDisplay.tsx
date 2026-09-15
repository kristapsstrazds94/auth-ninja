import QRCode from "react-qr-code";

type QrCodeDisplayProps = {
  value: string;
  label?: string;
};

export function QrCodeDisplay({
  value,
  label = "Scan with your authenticator app",
}: QrCodeDisplayProps) {
  return (
    <div className="qr-block">
      <p className="qr-label">{label}</p>
      <div className="qr-frame" aria-hidden="true">
        <QRCode value={value} size={192} level="M" bgColor="#FFFFFF" fgColor="#080D1D" />
      </div>
    </div>
  );
}
