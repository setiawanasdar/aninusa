// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsMenu } from "./SettingsMenu";
import { DEFAULT_SUBTITLE_STYLE } from "./utils";

const baseProps = {
  open: true,
  onClose: vi.fn(),
  qualityOptions: [
    { value: 1080, label: "1080p" },
    { value: 720, label: "720p" },
  ],
  selectedQuality: -1,
  onQualityChange: vi.fn(),
  playbackRate: 1,
  onPlaybackRateChange: vi.fn(),
  subtitles: [
    { id: "id", language: "id", label: "Bahasa Indonesia", format: "VTT" as const, url: "/id.vtt" },
    { id: "en", language: "en", label: "English", format: "VTT" as const, url: "/en.vtt" },
  ],
  subtitleId: "id",
  onSubtitleChange: vi.fn(),
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  onSubtitleStyleChange: vi.fn(),
  autoNext: true,
  onAutoNextChange: vi.fn(),
};

describe("SettingsMenu", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SettingsMenu {...baseProps} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows quality options, speed and subtitle tracks", () => {
    render(<SettingsMenu {...baseProps} />);

    expect(screen.getByRole("dialog", { name: "Pengaturan pemutar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1080p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1.5×" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bahasa Indonesia/ })).toBeInTheDocument();
  });

  it("changes quality when an option is selected", () => {
    const onQualityChange = vi.fn();
    render(<SettingsMenu {...baseProps} onQualityChange={onQualityChange} />);

    fireEvent.click(screen.getByRole("button", { name: "720p" }));
    expect(onQualityChange).toHaveBeenCalledWith(720);
  });

  it("disables subtitles via the off option", () => {
    const onSubtitleChange = vi.fn();
    render(<SettingsMenu {...baseProps} onSubtitleChange={onSubtitleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Nonaktif" }));
    expect(onSubtitleChange).toHaveBeenCalledWith(null);
  });

  it("exposes the auto-next switch state", () => {
    const onAutoNextChange = vi.fn();
    render(<SettingsMenu {...baseProps} onAutoNextChange={onAutoNextChange} />);

    const toggle = screen.getByRole("switch", { name: "Putar episode berikutnya otomatis" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(onAutoNextChange).toHaveBeenCalledWith(false);
  });
});
