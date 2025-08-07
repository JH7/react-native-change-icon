package com.reactnativechangeicon;

import androidx.annotation.NonNull;

import android.app.Activity;
import android.app.Application;
import android.content.pm.PackageManager;
import android.content.ComponentName;
import android.os.Bundle;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

// New Architecture
import com.reactnativechangeicon.NativeChangeIconSpec;

import java.util.HashSet;
import java.util.Set;

@ReactModule(name = ChangeIconModule.NAME)
public class ChangeIconModule extends NativeChangeIconSpec implements Application.ActivityLifecycleCallbacks {
    public static final String NAME = "ChangeIcon";
    private final String packageName;
    private final Set<String> classesToKill = new HashSet<>();
    private Boolean iconChanged = false;
    private String componentClass = "";

    public ChangeIconModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.packageName = reactContext.getPackageName();
    }

    @Override
    @NonNull
    public String getName() {
        return NAME;
    }

    @ReactMethod
    @Override
    public void getIcon(Promise promise) {
        final Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("ANDROID:ACTIVITY_NOT_FOUND", "Activity not found");
            return;
        }

        final String activityName = activity.getComponentName().getClassName();

        if (activityName.endsWith("MainActivity")) {
            promise.resolve("standard");
            return;
        }
        String[] activityNameSplit = activityName.split("\\.");
        promise.resolve(activityNameSplit[activityNameSplit.length - 1]);
    }

    @ReactMethod
    @Override
    public void changeIcon(String iconName, Promise promise) {
        final Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("ANDROID:ACTIVITY_NOT_FOUND", "Activity not found");
            return;
        }
        
        final String activityName = activity.getComponentName().getClassName();
        if (this.componentClass.isEmpty()) {
            this.componentClass = activityName.endsWith("MainActivity") ? this.packageName + ".standard" : activityName;
        }

        final String newIconName = (iconName == null || iconName.isEmpty()) ? "standard" : iconName;
        final String activeClass = this.packageName + "." + newIconName;
        if (this.componentClass.equals(activeClass)) {
            promise.reject("ANDROID:ICON_ALREADY_USED", "Icon already in use: " + this.componentClass);
            return;
        }
        try {
            activity.getPackageManager().setComponentEnabledSetting(
                    new ComponentName(this.packageName, activeClass),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP);
            promise.resolve(newIconName);
        } catch (Exception e) {
            promise.reject("ANDROID:ICON_INVALID", "Invalid icon name", e);
            return;
        }
        this.classesToKill.add(this.componentClass);
        this.componentClass = activeClass;
        activity.getApplication().registerActivityLifecycleCallbacks(this);
        iconChanged = true;
    }

    @ReactMethod
    @Override
    public void resetIcon(Promise promise) {
        changeIcon(null, promise);
    }

    // ...existing lifecycle methods...
    private void completeIconChange() {
        if (!iconChanged)
            return;
        final Activity activity = getCurrentActivity();
        if (activity == null)
            return;
        
        classesToKill.remove(componentClass);
        for (String cls : classesToKill) {
            try {
                activity.getPackageManager().setComponentEnabledSetting(
                    new ComponentName(this.packageName, cls),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP);
            } catch(Exception e) {
                
            }
        }
        
        classesToKill.clear();
        iconChanged = false;
    }

    @Override
    public void onActivityPaused(Activity activity) {
        completeIconChange();
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
    }

    @Override
    public void onActivityStarted(Activity activity) {
    }

    @Override
    public void onActivityResumed(Activity activity) {
    }

    @Override
    public void onActivityStopped(Activity activity) {
    }

    @Override
    public void onActivitySaveInstanceState(Activity activity, Bundle outState) {
    }

    @Override
    public void onActivityDestroyed(Activity activity) {
    }
}
