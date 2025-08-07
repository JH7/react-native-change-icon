package com.reactnativechangeicon;

import androidx.annotation.Nullable;

import com.facebook.react.BaseReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;

import java.util.HashMap;
import java.util.Map;

public class ChangeIconPackage extends BaseReactPackage {
    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return new ReactModuleInfoProvider() {
            @Override
            public Map<String, ReactModuleInfo> getReactModuleInfos() {
                Map<String, ReactModuleInfo> map = new HashMap<>();
                map.put(ChangeIconModule.NAME, new ReactModuleInfo(
                ChangeIconModule.NAME,       // name
                ChangeIconModule.NAME,       // className
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCXXModule
                true   // isTurboModule
                ));
                return map;
            }
            };
    }

    @Nullable
    @Override
    public NativeModule getModule(String name, ReactApplicationContext reactContext) {
        if (name.equals(ChangeIconModule.NAME)) {
            return new ChangeIconModule(reactContext);
        } else {
            return null;
        }
    }
}