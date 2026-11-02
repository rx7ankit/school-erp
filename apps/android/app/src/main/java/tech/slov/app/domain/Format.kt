package tech.slov.app.domain

/** 84.0 -> "84%", 84.25 -> "84.3%". */
fun percent(value: Double): String {
    val rounded = Math.round(value * 10) / 10.0
    return if (rounded % 1.0 == 0.0) "${rounded.toInt()}%" else "$rounded%"
}
