export const lightLabels = {live:'Local time',day:'Daylight',sunset:'Sunset',night:'Night'} as const;
export type HarborLight = keyof typeof lightLabels;
export type ScenePreferences = { light: HarborLight; economy: boolean };
const key = 'sf-waterfront-presentation-v1';
const defaults: ScenePreferences = { light:'live', economy:false };
let memory = defaults;
export const sceneEvent = 'sf-waterfront-presentation-change';
export function readScenePreferences():ScenePreferences {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const value = JSON.parse(raw);
    return { light:Object.hasOwn(lightLabels,value?.light) ? value.light : 'live', economy:value?.economy===true };
  } catch { return memory; }
}
export function saveScenePreferences(value:ScenePreferences) {
  memory=value;
  try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* Still usable in this tab. */ }
  window.dispatchEvent(new CustomEvent(sceneEvent,{detail:value}));
}
