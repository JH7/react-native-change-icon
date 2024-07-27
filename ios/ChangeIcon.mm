#import "ChangeIcon.h"

@implementation ChangeIcon
RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_REMAP_METHOD(getIcon, resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
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

RCT_REMAP_METHOD(changeIcon, iconName:(NSString *)iconName resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSString *iconNameTogether = [@"icon-" stringByAppendingString:iconName];
      
        // bool useUnsafeSuppressAlert = [[options objectForKey: @"useUnsafeSuppressAlert"] boolValue];
        bool useUnsafeSuppressAlert = true;
        NSError *error = nil;

        if ([[UIApplication sharedApplication] supportsAlternateIcons] == NO) {
            reject(@"Error", @"IOS:NOT_SUPPORTED", error);
            return;
        }

        NSString *currentIcon = [[UIApplication sharedApplication] alternateIconName];

        if ([iconNameTogether isEqualToString:currentIcon]) {
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
                        resolve(newIconName);
                    }
                });
            }
            @catch (NSException *exception) {
              // fallback on safe method
              [[UIApplication sharedApplication] setAlternateIconName:newIconName completionHandler:^(NSError * _Nullable error) {
                if (error != nil) {
                    reject(@"Error", @"IOS:SAFE_ERROR", error);
                } else {
                    resolve(newIconName);
                }
              }];
            }
        } else {
          [[UIApplication sharedApplication] setAlternateIconName:newIconName completionHandler:^(NSError * _Nullable error) {
              if (error != nil) {
                    reject(@"Error", @"IOS:ERROR", error);
                } else {
                    resolve(newIconName);
                }
          }];
        }
        
    });
}

@end
