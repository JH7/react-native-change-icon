#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <NativeChangeIconSpec/NativeChangeIconSpec.h>
@interface ChangeIcon : NSObject <NativeChangeIconSpec>
#else
#import <React/RCTBridgeModule.h>
@interface ChangeIcon : NSObject <RCTBridgeModule>
#endif

@end