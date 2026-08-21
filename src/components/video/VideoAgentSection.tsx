import { useState } from "react";
import { SlotStudio } from "@/components/video/SlotStudio";
import { Reveal } from "@/components/visual/Reveal";
import { streamImage } from "@/lib/streamImage";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/auroraModels";

type Result = { frame: string | null; status: string };

const empty: Result = { frame: null, status: "idle" };

function useToolRun() {
  const [result, setResult] = useState<Result>(empty);

  async function run(prompt: string, imageDataUrl: string | undefined, model: string) {
    setResult({ frame: null, status: "rendering" });
    try {
      await streamImage(
        "/api/generate-image",
        {
          prompt,
          imageDataUrl,
          model: IMAGE_MODELS.some((m) => m.id === model) ? model : IMAGE_MODELS[0].id,
        },
        (dataUrl, isFinal) =>
          setResult({ frame: dataUrl, status: isFinal ? "done" : "rendering" }),
      );
    } catch (err) {
      setResult({ frame: null, status: err instanceof Error ? err.message : "failed" });
    }
  }

  return { result, run };
}

function Output({ result, label }: { result: Result; label: string }) {
  if (result.status === "idle") return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="glow-frame overflow-hidden bg-card">
        {result.frame ? (
          <img src={result.frame} alt={label} className="w-full object-cover" />
        ) : (
          <div className="grid h-40 place-items-center">
            <span className="font-[family-name:var(--font-mono-ui)] text-xs tracking-[0.25em] text-accent uppercase">
              ● {result.status}
            </span>
          </div>
        )}
      </div>
      <span className="label-chip">{result.status}</span>
    </div>
  );
}

export function VideoAgentSection() {
  const agent = useToolRun();
  const lip = useToolRun();
  const motion = useToolRun();

  const videoModelOptions = VIDEO_MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    available: m.available,
  }));
  const imageModelOptions = IMAGE_MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    available: m.available,
  }));

  return (
    <section id="video-agent" className="border-y border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="font-[family-name:var(--font-mono-ui)] text-xs tracking-[0.3em] text-accent uppercase">
            Step three — the video agent
          </p>
          <h2 className="headline mt-4 text-[clamp(2.3rem,7vw,4.5rem)]">
            Layers move.
            <span className="gradient-text block">On command.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-muted-foreground">
            Hand a finished layer to the agent, pick the engine, and it directs the shot for you —
            the plate stays locked the whole way through.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <SlotStudio
            id="tool-video-agent"
            tool="Video agent"
            icon="✦"
            models={videoModelOptions}
            hint="Drop the locked layer, describe the shot. The agent boards it, then renders on the selected engine."
            slots={[
              { key: "character", label: "Add character", icon: "👤", kind: "image" },
              {
                key: "shot",
                label: "Direct the shot",
                icon: "🎬",
                kind: "text",
                placeholder: "slow dolly-in, neon street haze, hair moving in the wind",
              },
            ]}
            onGenerate={(v, model) =>
              agent.run(
                `Cinematic keyframe for a video shot. ${v.shot}. Keep the subject, wardrobe, jewelry and background identical to the reference. Target engine: ${model}.`,
                v.character,
                model,
              )
            }
          />
          <Output result={agent.result} label="Video agent keyframe" />
        </Reveal>

        <Reveal className="mt-8" delay={100}>
          <SlotStudio
            id="tool-lip-sync"
            tool="Lip sync"
            icon="🗣"
            models={videoModelOptions}
            hint="Add a face and the line they speak. Mouth shapes drive from the audio; everything else holds."
            slots={[
              { key: "face", label: "Add face", icon: "🙂", kind: "image" },
              {
                key: "speech",
                label: "Add speech",
                icon: "🎙",
                kind: "text",
                placeholder: "“Aurora locked the whole frame — I only changed the chain.”",
              },
            ]}
            onGenerate={(v, model) =>
              lip.run(
                `Lip-sync keyframe: the person is mid-speech saying "${v.speech}". Preserve identity, framing and lighting exactly. Target engine: ${model}.`,
                v.face,
                model,
              )
            }
          />
          <Output result={lip.result} label="Lip sync keyframe" />
        </Reveal>

        <Reveal className="mt-8" delay={200}>
          <SlotStudio
            id="tool-motion-control"
            tool="Motion transfer"
            icon="🕺"
            models={imageModelOptions}
            hint="Add your character, then the expression and motion to transfer. Identity stays, performance changes."
            slots={[
              { key: "character", label: "Add character", icon: "👤", kind: "image" },
              {
                key: "motion",
                label: "Add expression & motion",
                icon: "⚡",
                kind: "text",
                placeholder: "head tilt back, arms wide, laughing into the light",
              },
            ]}
            onGenerate={(v, model) =>
              motion.run(
                `Transfer this performance onto the subject: ${v.motion}. Keep face, body, wardrobe and background identical. Target engine: ${model}.`,
                v.character,
                model,
              )
            }
          />
          <Output result={motion.result} label="Motion transfer frame" />
        </Reveal>

        <Reveal className="mt-12" delay={120}>
          <p className="font-[family-name:var(--font-mono-ui)] text-[0.7rem] tracking-[0.3em] text-muted-foreground uppercase">
            Engines available in the agent
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...VIDEO_MODELS, ...IMAGE_MODELS].map((m) => (
              <span
                key={m.id}
                className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold"
                style={{ opacity: m.available ? 1 : 0.55 }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
