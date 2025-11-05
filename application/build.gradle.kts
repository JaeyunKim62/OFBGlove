// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    id("com.chaquo.python") version "15.0.1" apply false
    id("com.google.gms.google-services") version "4.4.4" apply false
}

// Auto-cleanup task to prevent file lock issues
tasks.register("cleanup") {
    group = "build"
    description = "Clean up build artifacts and prevent file lock issues"
    
    doLast {
        // Clean build directories
        delete("build")
        delete("app/build")
        
        // Clean Gradle cache
        delete("$gradle.gradleUserHomeDir/caches")
        
        println("Build cleanup completed successfully")
    }
}