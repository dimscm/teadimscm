# kotlinx.serialization keeps the generated serializers on the companion object.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keepclassmembers class com.dimscm.moneyprinter.** {
    *** Companion;
}
-keepclasseswithmembers class com.dimscm.moneyprinter.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit / OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keepattributes Signature
-keepattributes Exceptions
