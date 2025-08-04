#import "ChangeIcon.h"

@implementation ChangeIcon

- (id) init {
  return self;
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeChangeIconSpecJSI>(params);
}
#endif

- (void)getIcon:(RCTPromiseResolveBlock)resolve
       rejecter:(RCTPromiseRejectBlock)reject {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSString *currentIconName = [[UIApplication sharedApplication] alternateIconName];
        if (currentIconName) {
            NSString *currentIcon = [currentIconName stringByReplacingOccurrencesOfString:@"icon-" withString:@""];
            resolve(currentIcon);
        } else {
            resolve(@"standard");
        }
    });
}

- (void)resetIcon:(RCTPromiseResolveBlock)resolve
         rejecter:(RCTPromiseRejectBlock)reject {
    [self changeIcon:nil resolver:resolve rejecter:reject];
}

- (void)changeIcon:(NSString *)iconName
          resolver:(RCTPromiseResolveBlock)resolve
          rejecter:(RCTPromiseRejectBlock)reject {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSString *iconNameTogether = iconName ? [@"icon-" stringByAppendingString:iconName] : nil;
      
        bool useUnsafeSuppressAlert = true;
        NSError *error = nil;

        if ([[UIApplication sharedApplication] supportsAlternateIcons] == NO) {
            reject(@"Error", @"IOS:NOT_SUPPORTED", error);
            return;
        }

        NSString *currentIcon = [[UIApplication sharedApplication] alternateIconName];

        if ([iconNameTogether isEqualToString:currentIcon] || (iconNameTogether == nil && currentIcon == nil)) {
            reject(@"Error", @"IOS:ICON_ALREADY_USED", error);
            return;
        }

        NSString *newIconName;
        if (iconName == nil || [iconName length] == 0 || [iconName isEqualToString:@"Default"]) {
            newIconName = nil;
        } else {
            newIconName = iconNameTogether;
        }
        
        if (useUnsafeSuppressAlert == true) {
            @try {
                typedef void (*setAlternateIconName)(NSObject *, SEL, NSString *, void (^)(NSError *));
                NSString *selectorString = @"_setAlternateIconName:completionHandler:";
                SEL selector = NSSelectorFromString(selectorString);
                IMP imp = [[UIApplication sharedApplication] methodForSelector:selector];
                setAlternateIconName method = (setAlternateIconName)imp;
                method([UIApplication sharedApplication], selector, newIconName, ^(NSError *error) {
                    if (error != nil) {
                        reject(@"Error", @"IOS:UNSAFE_ERROR", error);
                    } else {
                        resolve(newIconName ?: @"standard");
                    }
                });
            }
            @catch (NSException *exception) {
              [[UIApplication sharedApplication] setAlternateIconName:newIconName completionHandler:^(NSError * _Nullable error) {
                if (error != nil) {
                    reject(@"Error", @"IOS:SAFE_ERROR", error);
                } else {
                    resolve(newIconName ?: @"standard");
                }
              }];
            }
        } else {
          [[UIApplication sharedApplication] setAlternateIconName:newIconName completionHandler:^(NSError * _Nullable error) {
              if (error != nil) {
                    reject(@"Error", @"IOS:ERROR", error);
                } else {
                    resolve(newIconName ?: @"standard");
                }
          }];
        }
    });
}

+ (NSString *)moduleName
{
  return @"ChangeIcon";
}

#ifndef RCT_NEW_ARCH_ENABLED
RCT_EXPORT_MODULE()
RCT_EXPORT_METHOD(getIcon:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXPORT_METHOD(changeIcon:(NSString *)iconName resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXPORT_METHOD(resetIcon:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
#endif

@end