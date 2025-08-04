import type { TurboModule } from 'react-native';
export interface Spec extends TurboModule {
    readonly getConstants: () => {};
    changeIcon: (iconName?: string) => Promise<string>;
    resetIcon: () => Promise<string>;
    getIcon: () => Promise<string>;
}
declare const _default: Spec | null;
export default _default;
