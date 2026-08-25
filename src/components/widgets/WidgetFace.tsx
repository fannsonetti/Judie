import type { ReactNode } from "react";
import { WidgetSize, WidgetType } from "../../types/widgets";
import { WeatherWidget } from "./WeatherWidget";
import { LightsWidget } from "./LightsWidget";
import { MediaWidget } from "./MediaWidget";
import { CalendarWidget } from "./CalendarWidget";
import { ClimateWidget } from "./ClimateWidget";
import { PurifierWidget } from "./PurifierWidget";
import { QuickControlsWidget } from "./QuickControlsWidget";
import { ServerWidget } from "./ServerWidget";
import { ActivityWidget } from "./ActivityWidget";
import { TimersWidget } from "./TimersWidget";
import { SystemWidget } from "./SystemWidget";
import { SlopWidget } from "./SlopWidget";

export function WidgetFace({
  type,
  size,
  customId,
}: {
  type: WidgetType;
  size: WidgetSize;
  customId?: string;
}): ReactNode {
  let face: ReactNode = null;
  switch (type) {
    case "weather":
      face = <WeatherWidget size={size} />;
      break;
    case "lights":
      face = <LightsWidget size={size} />;
      break;
    case "media":
      face = <MediaWidget size={size} />;
      break;
    case "calendar":
      face = <CalendarWidget size={size} />;
      break;
    case "climate":
      face = <ClimateWidget size={size} />;
      break;
    case "purifier":
      face = <PurifierWidget size={size} />;
      break;
    case "quickControls":
      face = <QuickControlsWidget size={size} />;
      break;
    case "server":
      face = <ServerWidget size={size} />;
      break;
    case "activity":
      face = <ActivityWidget size={size} />;
      break;
    case "timers":
      face = <TimersWidget size={size} />;
      break;
    case "system":
      face = <SystemWidget size={size} />;
      break;
    case "custom":
      face = <SlopWidget customId={customId} size={size} />;
      break;
    default:
      face = null;
  }
  return <div className={`wx-host size-${size}`}>{face}</div>;
}
