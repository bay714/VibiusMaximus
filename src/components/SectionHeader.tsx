import React from "react";
import { useTranslation } from "react-i18next";
import { SECTIONS_CONFIG, type SidebarSection } from "./Sidebar";

/** Page title: the section's icon on a red tile, then its name. */
export const SectionHeader: React.FC<{ section: SidebarSection }> = ({
  section,
}) => {
  const { t } = useTranslation();
  const config = SECTIONS_CONFIG[section] ?? SECTIONS_CONFIG.general;
  const Icon = config.icon;
  return (
    <div className="max-w-3xl w-full flex items-center gap-3 pt-2">
      <span className="legion-tile" aria-hidden>
        <Icon width={18} height={18} strokeWidth={1.9} />
      </span>
      <h1 className="font-display text-2xl tracking-wide">
        {t(config.labelKey)}
      </h1>
    </div>
  );
};
