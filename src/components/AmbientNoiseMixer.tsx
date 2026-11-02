'use client';

import React, { useEffect, useState } from 'react';
import {
  ambientSound,
  AmbientSoundTrack,
  AmbientState,
  DEFAULT_AMBIENT_STATE,
} from '@/lib/ambientSound';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  CloudRain,
  Flame,
  Radio,
  Waves,
  Sparkles,
  Sliders,
  X,
} from 'lucide-react';

const TRACK_CONFIG: Array<{
  id: AmbientSoundTrack;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}> = [
  {
    id: 'rain',
    label: 'Rainfall',
    icon: CloudRain,
    color: 'text-sky-500 dark:text-sky-400',
    description: 'Gentle droplet patterns & rain shower',
  },
  {
    id: 'brown',
    label: 'Brown Noise',
    icon: Waves,
    color: 'text-amber-600 dark:text-amber-400',
    description: 'Deep low-frequency waterfall hum',
  },
  {
    id: 'binaural',
    label: 'Alpha Wave (10Hz)',
    icon: Sparkles,
    color: 'text-indigo-500 dark:text-indigo-400',
    description: 'Binaural focus tone for deep concentration',
  },
  {
    id: 'campfire',
    label: 'Campfire',
    icon: Flame,
    color: 'text-rose-500 dark:text-rose-400',
    description: 'Cozy hearth crackles & ember snaps',
  },
  {
    id: 'pink',
    label: 'Pink Noise',
    icon: Waves,
    color: 'text-pink-500 dark:text-pink-400',
    description: 'Natural balanced acoustic pink noise',
  },
  {
    id: 'white',
    label: 'White Noise',
    icon: Radio,
    color: 'text-slate-500 dark:text-slate-400',
    description: 'Crisp static background noise',
  },
];

interface AmbientNoiseMixerProps {
  compact?: boolean;
}

export function AmbientNoiseMixer({ compact = false }: AmbientNoiseMixerProps) {
  const [state, setState] = useState<AmbientState>(() =>
    ambientSound ? ambientSound.getState() : DEFAULT_AMBIENT_STATE
  );
  const [expanded, setExpanded] = useState(!compact);
  const [compactMixerOpen, setCompactMixerOpen] = useState(false);

  useEffect(() => {
    if (!ambientSound) return;
    setState(ambientSound.getState());
    const unsub = ambientSound.subscribe((s) => setState(s));
    return unsub;
  }, []);

  useEffect(() => {
    if (!compactMixerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCompactMixerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [compactMixerOpen]);

  const handleTogglePlay = async () => {
    if (!ambientSound) return;
    await ambientSound.togglePlay();
  };

  const handleMasterVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!ambientSound) return;
    ambientSound.setMasterVolume(parseFloat(e.target.value));
  };

  const handleTrackVolume = (track: AmbientSoundTrack, val: number) => {
    if (!ambientSound) return;
    ambientSound.setTrackVolume(track, val);
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={handleTogglePlay}
          data-testid="floating-noise-toggle"
          title={state.isPlaying ? 'Mute Ambient Noise' : 'Play Ambient Noise'}
          aria-label={state.isPlaying ? 'Mute Ambient Noise' : 'Play Ambient Noise'}
          className={`p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer ${
            state.isPlaying
              ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
              : 'bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-slate-300'
          }`}
        >
          {state.isPlaying ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4 opacity-70" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setCompactMixerOpen(!compactMixerOpen)}
          data-testid="floating-noise-sliders"
          title="Adjust Individual Sound Sliders"
          aria-label="Adjust Individual Sound Sliders"
          className={`p-1.5 sm:p-2 rounded-lg border transition-colors cursor-pointer ${
            compactMixerOpen
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-slate-300 border-slate-700/80 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Floating Compact Mixer Popover */}
        {compactMixerOpen && (
          <div
            data-testid="compact-mixer-popover"
            className="absolute bottom-full right-0 mb-3 w-76 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl p-4 shadow-2xl z-50 text-white space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white">Ambient Sound Mixer</h5>
                  <p className="text-[10px] text-slate-400">Synthesized on device</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompactMixerOpen(false)}
                data-testid="compact-mixer-close"
                aria-label="Close Mixer"
                title="Close Mixer"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] no-scrollbar">
              <button
                type="button"
                onClick={() => ambientSound?.applyPreset('deep_focus')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 shrink-0 font-medium transition-colors"
              >
                🧠 Focus
              </button>
              <button
                type="button"
                onClick={() => ambientSound?.applyPreset('rainy_study')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-600/30 text-slate-300 hover:text-sky-300 shrink-0 font-medium transition-colors"
              >
                🌧️ Rain
              </button>
              <button
                type="button"
                onClick={() => ambientSound?.applyPreset('campfire_library')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-600/30 text-slate-300 hover:text-amber-300 shrink-0 font-medium transition-colors"
              >
                🔥 Fire
              </button>
              <button
                type="button"
                onClick={() => ambientSound?.applyPreset('brownian_calm')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 font-medium transition-colors"
              >
                🌊 Brown
              </button>
            </div>

            {/* Master Volume */}
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Master Volume</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {Math.round(state.masterVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={state.masterVolume}
                onChange={handleMasterVolume}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Individual Sound Sliders */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {TRACK_CONFIG.map((track) => {
                const Icon = track.icon;
                const currentVol = state.volumes[track.id] || 0;
                return (
                  <div
                    key={track.id}
                    className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-200 text-[11px]">
                        <Icon className={`w-3 h-3 ${track.color}`} />
                        <span>{track.label}</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {Math.round(currentVol * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      value={currentVol}
                      onChange={(e) => handleTrackVolume(track.id, parseFloat(e.target.value))}
                      className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              state.isPlaying
                ? 'bg-blue-600 text-white ring-4 ring-blue-500/10'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {state.isPlaying ? <Volume2 className="w-4 h-4 animate-bounce" /> : <VolumeX className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Ambient Focus Noise
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Web Audio client-side synthesis • 0 network latency
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              state.isPlaying
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
            }`}
          >
            {state.isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Mixer Sliders"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Presets Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 text-xs no-scrollbar">
        <span className="text-[11px] font-medium text-slate-400 mr-1 shrink-0">Presets:</span>
        <button
          onClick={() => ambientSound?.applyPreset('deep_focus')}
          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-[11px] font-medium transition-colors shrink-0"
        >
          🧠 Deep Focus
        </button>
        <button
          onClick={() => ambientSound?.applyPreset('rainy_study')}
          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 text-[11px] font-medium transition-colors shrink-0"
        >
          🌧️ Rainy Study
        </button>
        <button
          onClick={() => ambientSound?.applyPreset('campfire_library')}
          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 text-[11px] font-medium transition-colors shrink-0"
        >
          🔥 Campfire
        </button>
        <button
          onClick={() => ambientSound?.applyPreset('brownian_calm')}
          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors shrink-0"
        >
          🌊 Brown Noise
        </button>
      </div>

      {/* Master Volume Bar */}
      <div className="flex items-center gap-3 py-2 px-1 bg-slate-50 dark:bg-slate-950/60 rounded-xl mb-3">
        <Volume2 className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0">Master:</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={state.masterVolume}
          onChange={handleMasterVolume}
          className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
        />
        <span className="text-[11px] font-mono font-medium text-slate-500 w-8 text-right mr-2">
          {Math.round(state.masterVolume * 100)}%
        </span>
      </div>

      {/* Expanded Track Sliders Grid */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {TRACK_CONFIG.map((track) => {
            const Icon = track.icon;
            const currentVol = state.volumes[track.id] || 0;
            return (
              <div
                key={track.id}
                className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col gap-1.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${track.color}`} />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {track.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {Math.round(currentVol * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={currentVol}
                  onChange={(e) => handleTrackVolume(track.id, parseFloat(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
