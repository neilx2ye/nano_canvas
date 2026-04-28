import { useRef, useState } from "react";
import {
  ModelSelector,
  ImageSizeSelector,
  ParamControls,
  TokenDisplay,
} from "../components/Controls";
import { ApiKeyConfig, AutoSaveFolder } from "../components/Settings";
import { PromptInput as MainPromptInput, RefImageUpload } from "../components/Prompt";
import { InfiniteCanvas, CanvasToolbar } from "../components/Canvas";
import type { InfiniteCanvasHandle } from "../components/Canvas";
import type { Canvas as FabricCanvas } from "fabric";

function MainPage() {
  const canvasRef = useRef<InfiniteCanvasHandle>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  const [mobileTab, setMobileTab] = useState<"controls" | "canvas">("controls");

  return (
    <div className="h-screen flex flex-col bg-white">
      <header className="h-14 border-b border-light-gray flex items-center px-6 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center">
            <span className="text-white font-display font-medium text-sm">N</span>
          </div>
          <h1 className="text-base font-display font-medium text-near-black">Nano Canvas</h1>
        </div>

        <div
          className="ml-auto flex md:hidden gap-1 bg-snow p-1 rounded-pill"
          aria-label="Mobile view switcher"
          title="Switch between controls and canvas on small screens"
        >
          <button
            onClick={() => setMobileTab("controls")}
            aria-pressed={mobileTab === "controls"}
            className={`px-4 py-1.5 text-sm font-sans rounded-pill transition-colors ${
              mobileTab === "controls"
                ? "bg-white text-near-black shadow-sm"
                : "text-stone"
            }`}
          >
            Controls
          </button>
          <button
            onClick={() => setMobileTab("canvas")}
            aria-pressed={mobileTab === "canvas"}
            className={`px-4 py-1.5 text-sm font-sans rounded-pill transition-colors ${
              mobileTab === "canvas"
                ? "bg-white text-near-black shadow-sm"
                : "text-stone"
            }`}
          >
            Canvas
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className={`${mobileTab === "canvas" ? "hidden md:block" : ""} w-[340px] bg-snow border-r border-light-gray overflow-y-auto shrink-0`}>
          <div className="p-6 flex flex-col gap-6">
            <ApiKeyConfig />
            <div className="h-px bg-light-gray" />
            <AutoSaveFolder />
            <div className="h-px bg-light-gray" />
            <ModelSelector />
            <div className="h-px bg-light-gray" />
            <ImageSizeSelector />
            <div className="h-px bg-light-gray" />
            <ParamControls />
            <div className="h-px bg-light-gray" />
            <RefImageUpload />
            <div className="h-px bg-light-gray" />
            <TokenDisplay />
            <div className="h-px bg-light-gray" />
            <MainPromptInput />
          </div>
        </aside>

        <main className={`${mobileTab === "controls" ? "hidden md:block" : ""} flex-1 relative bg-white`}>
          <InfiniteCanvas ref={canvasRef} className="absolute inset-0" />
          <CanvasToolbar fabricCanvasRef={fabricCanvasRef} />
        </main>
      </div>
    </div>
  );
}

export default MainPage;
