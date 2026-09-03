import { GeneralSection } from "@/components/settings/GeneralSection";
import { SettingsDrilldownList } from "@/components/settings/SettingsDrilldownList";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <GeneralSection />
      <SettingsDrilldownList />
    </div>
  );
}
