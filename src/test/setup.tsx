import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

vi.mock("next/image", () => {
  const Image = React.forwardRef<HTMLImageElement, React.ComponentProps<"img">>(
    ({ alt, ...props }, ref) => <img ref={ref} alt={alt} {...props} />
  );

  Image.displayName = "NextImageMock";

  return { default: Image };
});

