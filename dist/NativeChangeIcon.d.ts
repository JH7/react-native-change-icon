import type { TurboModule } from 'react-native';
export interface Spec extends TurboModule {
    changeIcon: (iconName?: string) => Promise<string>;
    resetIcon: () => Promise<string>;
    getIcon: () => Promise<string>;
}
declare const _default: Spec;
export default _default;
