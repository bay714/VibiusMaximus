import React from "react";
import { useTranslation } from "react-i18next";
// Legion icon set: Roman-flavoured, in lucide's modern line style.
import {
  AudioWaveform,
  Crosshair,
  Feather,
  FlaskConical,
  Hourglass,
  Images,
  Keyboard,
  Landmark,
  Scroll,
  ShieldHalf,
  Swords,
} from "lucide-react";
import VibiusLogo from "./icons/VibiusLogo";
import { useSettings } from "../hooks/useSettings";
import {
  GeneralSettings,
  AdvancedSettings,
  HistorySettings,
  DebugSettings,
  AboutSettings,
  PostProcessingSettings,
  ModelsSettings,
  MacrosSettings,
  CapturesSettings,
  CaptureSettings,
  HotkeysSettings,
} from "./settings";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface IconProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
  [key: string]: any;
}

interface SectionConfig {
  labelKey: string;
  icon: React.ComponentType<IconProps>;
  component: React.ComponentType;
  enabled: (settings: any) => boolean;
}

export const SECTIONS_CONFIG = {
  general: {
    labelKey: "sidebar.general",
    icon: Landmark,
    component: GeneralSettings,
    enabled: () => true,
  },
  capture: {
    labelKey: "sidebar.capture",
    icon: Crosshair,
    component: CaptureSettings,
    enabled: () => true,
  },
  macros: {
    labelKey: "sidebar.macros",
    icon: Scroll,
    component: MacrosSettings,
    enabled: () => true,
  },
  hotkeys: {
    labelKey: "sidebar.hotkeys",
    icon: Keyboard,
    component: HotkeysSettings,
    enabled: () => true,
  },
  captures: {
    labelKey: "sidebar.captures",
    icon: Images,
    component: CapturesSettings,
    enabled: () => true,
  },
  history: {
    labelKey: "sidebar.history",
    icon: Hourglass,
    component: HistorySettings,
    enabled: () => true,
  },
  models: {
    labelKey: "sidebar.models",
    icon: AudioWaveform,
    component: ModelsSettings,
    enabled: () => true,
  },
  advanced: {
    labelKey: "sidebar.advanced",
    icon: Swords,
    component: AdvancedSettings,
    enabled: () => true,
  },
  postprocessing: {
    labelKey: "sidebar.postProcessing",
    icon: Feather,
    component: PostProcessingSettings,
    enabled: (settings) => settings?.post_process_enabled ?? false,
  },
  debug: {
    labelKey: "sidebar.debug",
    icon: FlaskConical,
    component: DebugSettings,
    enabled: (settings) => settings?.debug_mode ?? false,
  },
  about: {
    labelKey: "sidebar.about",
    icon: ShieldHalf,
    component: AboutSettings,
    enabled: () => true,
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();

  const availableSections = Object.entries(SECTIONS_CONFIG)
    .filter(([_, config]) => config.enabled(settings))
    .map(([id, config]) => ({ id: id as SidebarSection, ...config }));

  return (
    <div className="legion-sidebar flex flex-col w-44 h-full border-e border-mid-gray/20 items-center px-2">
      <VibiusLogo size={42} className="self-start ms-2 mt-4 mb-4" />
      <div className="legion-rule mb-2" />
      <div className="flex flex-col w-full items-center gap-0.5 pt-1">
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <div
              key={section.id}
              className={`flex gap-2.5 items-center px-2.5 py-2 w-full rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? "legion-nav-active"
                  : "hover:bg-mid-gray/15 hover:opacity-100 opacity-80"
              }`}
              onClick={() => onSectionChange(section.id)}
            >
              <Icon
                width={19}
                height={19}
                strokeWidth={1.75}
                className="shrink-0"
              />
              <p
                className="text-sm font-medium truncate"
                title={t(section.labelKey)}
              >
                {t(section.labelKey)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
