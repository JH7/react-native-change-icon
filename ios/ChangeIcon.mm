#import "ChangeIcon.h"

@implementation ChangeIcon
RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_REMAP_METHOD(getIcon, resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSString *currentIcon = [[UIApplication sharedApplication] alternateIconName];
        if (currentIcon) {
            resolve(currentIcon);
        } else {
            resolve(@"standard");
        }
    });
}

RCT_REMAP_METHOD(changeIcon, iconName:(NSString *)iconName resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
      
        // bool useUnsafeSuppressAlert = [[options objectForKey: @"useUnsafeSuppressAlert"] boolValue];
        bool useUnsafeSuppressAlert = true;
        NSError *error = nil;

        if ([[UIApplication sharedApplication] supportsAlternateIcons] == NO) {
            reject(@"Error", @"IOS:NOT_SUPPORTED", error);
            return;
        }

        NSString *currentIcon = [[UIApplication sharedApplication] alternateIconName];

        if ([iconName isEqualToString:currentIcon]) {
            reject(@"Error", @"IOS:ICON_ALREADY_USED", error);
            return;
        }

        NSString *newIconName;
        if (iconName == nil || [iconName length] == 0 || [iconName isEqualToString:@"Default"]) {
            newIconName = nil;
            resolve(@"standard");
        } else {
            newIconName = iconName;
            resolve(newIconName);
        }
        
        if (useUnsafeSuppressAlert == true) {
            @try {
                typedef void (*setAlternateIconName)(NSObject *, SEL, NSString *, void (^)(NSError *));
                NSString *selectorString = @"_setAlternateIconName:completionHandler:";
                SEL selector = NSSelectorFromString(selectorString);
                IMP imp = [[UIApplication sharedApplication] methodForSelector:selector];
                setAlternateIconName method = (setAlternateIconName)imp;
                method([UIApplication sharedApplication], selector, iconName, ^(NSError *error) {});
            }
            @catch (NSException *exception) {
              // fallback on safe method
              [[UIApplication sharedApplication] setAlternateIconName:newIconName completionHandler:^(NSError * _Nullable error) {
                return;
              }];
            }
        } else {
          [[UIApplication sharedApplication] setAlternateIconName:newIconName completionHandler:^(NSError * _Nullable error) {
              return;
          }];
        }
        
    });
}

@end
