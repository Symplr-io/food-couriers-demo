# ProGuard/R8 — release shrink + obfuscate. Enable in android/app/build.gradle:
#   release { minifyEnabled true; shrinkResources true; proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro' }
-keepattributes SourceFile,LineNumberTable,*Annotation*
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.react.**
# React Navigation / Reanimated
-keep class com.swmansion.** { *; }
# Keep your model classes (adjust the package):
-keep class **.model.** { *; }
