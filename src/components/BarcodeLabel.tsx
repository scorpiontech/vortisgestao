import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeSvgProps {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
}

export const detectFormat = (code: string) => {
  if (/^\d{13}$/.test(code)) return "EAN13";
  if (/^\d{12}$/.test(code)) return "UPC";
  if (/^\d{8}$/.test(code)) return "EAN8";
  return "CODE128";
};

export const BarcodeSvg = ({
  value,
  height = 40,
  width = 1.6,
  fontSize = 12,
  displayValue = true,
  className,
}: BarcodeSvgProps) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: detectFormat(value),
        height,
        width,
        fontSize,
        displayValue,
        margin: 0,
        lineColor: "#000000",
        background: "#ffffff",
      });
    } catch {
      // fallback: render as CODE128 if the detected format rejects the value
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128",
          height,
          width,
          fontSize,
          displayValue,
          margin: 0,
          lineColor: "#000000",
          background: "#ffffff",
        });
      } catch {
        /* ignore invalid codes */
      }
    }
  }, [value, height, width, fontSize, displayValue]);

  return <svg ref={ref} className={className} />;
};

/** Builds a standalone barcode SVG markup string (used for the print window). */
export const buildBarcodeSvgMarkup = (
  value: string,
  opts: { height?: number; width?: number; fontSize?: number } = {}
): string => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const options = {
    height: opts.height ?? 40,
    width: opts.width ?? 1.6,
    fontSize: opts.fontSize ?? 12,
    displayValue: true,
    margin: 0,
    lineColor: "#000000",
    background: "#ffffff",
  };
  try {
    JsBarcode(el, value, { ...options, format: detectFormat(value) });
  } catch {
    try {
      JsBarcode(el, value, { ...options, format: "CODE128" });
    } catch {
      return "";
    }
  }
  return el.outerHTML;
};
