# iOS simulators

We test the iOS app on exactly two simulators (iOS 27.2). Do not create or use others.

| Name | UDID |
| --- | --- |
| iPhone 18 Pro | DF6DF1B9-8AD5-4BA7-8DFB-51AB7AB731EF |
| iPhone Duo | 802C2DAF-1A60-486B-8AD5-13F31817678C |

Build, install and launch on both:

```bash
cd apps/ios && xcodebuild -project Krevo.xcodeproj -scheme Krevo -destination 'id=DF6DF1B9-8AD5-4BA7-8DFB-51AB7AB731EF' -derivedDataPath /tmp/krevo-sim build -quiet
APP=$(ls -d /tmp/krevo-sim/Build/Products/*-iphonesimulator/Krevo.app)
for d in DF6DF1B9-8AD5-4BA7-8DFB-51AB7AB731EF 802C2DAF-1A60-486B-8AD5-13F31817678C; do xcrun simctl install $d "$APP" && xcrun simctl launch $d tech.krevo.app; done
```
