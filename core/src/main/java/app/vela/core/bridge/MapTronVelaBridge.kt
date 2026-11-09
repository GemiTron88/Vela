package app.vela.core.bridge

import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Native Kotlin bridge connecting GemiTron88/Vela navigation physics and voice guidance
 * to GemiTron88/MapTron's Flutter SDK MethodChannel ("net.gemitron.maptron/vela_navigation").
 */
object MapTronVelaBridge {
    const val CHANNEL_NAME: String = "net.gemitron.maptron/vela_navigation"
    const val EXECUTION_MODE: String = "vela_native"
    private const val EARTH_RADIUS_M: Double = 6371000.0

    data class LatLngPoint(val latitude: Double, val longitude: Double)

    data class RouteStepPayload(
        val index: Int,
        val instructionEn: String,
        val instructionAr: String,
        val location: LatLngPoint,
    )

    /**
     * Accuracy-scaled off-route corridor matching Vela NavEngine.kt:
     * clamp(max(35.0, accuracyMeters * 1.65), 35.0, 90.0)
     */
    fun computeOffRouteCorridorMeters(accuracyMeters: Double): Double {
        val scaled = max(35.0, accuracyMeters * 1.65)
        return min(90.0, max(35.0, scaled))
    }

    /**
     * Haversine great-circle distance in meters.
     */
    fun haversineMeters(a: LatLngPoint, b: LatLngPoint): Double {
        val dLat = Math.toRadians(b.latitude - a.latitude)
        val dLon = Math.toRadians(b.longitude - a.longitude)
        val lat1 = Math.toRadians(a.latitude)
        val lat2 = Math.toRadians(b.latitude)
        val h = sin(dLat / 2.0) * sin(dLat / 2.0) +
            cos(lat1) * cos(lat2) * sin(dLon / 2.0) * sin(dLon / 2.0)
        return 2.0 * EARTH_RADIUS_M * asin(min(1.0, sqrt(max(0.0, h))))
    }

    /**
     * Forward initial bearing in degrees [0, 360).
     */
    fun initialBearingDegrees(a: LatLngPoint, b: LatLngPoint): Double {
        val dLon = Math.toRadians(b.longitude - a.longitude)
        val lat1 = Math.toRadians(a.latitude)
        val lat2 = Math.toRadians(b.latitude)
        val y = sin(dLon) * cos(lat2)
        val x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        return (Math.toDegrees(atan2(y, x)) + 360.0) % 360.0
    }

    /**
     * Decodes a 64-bit Polyline5/6/7 string into WGS84 coordinates.
     */
    fun decodePolyline(encoded: String, precision: Int = 6): List<LatLngPoint> {
        if (encoded.isEmpty()) return emptyList()
        var scale = 1.0
        repeat(precision) { scale *= 10.0 }
        val points = ArrayList<LatLngPoint>()
        var index = 0
        var lat = 0L
        var lng = 0L

        while (index < encoded.length) {
            var result = 0L
            var shift = 0
            var b: Int
            do {
                b = encoded[index++].code - 63
                result = result or ((b.toLong() and 0x1fL) shl shift)
                shift += 5
            } while (b >= 0x20 && index < encoded.length)
            val dLat = if ((result and 1L) != 0L) (result shr 1).inv() else (result shr 1)
            lat += dLat

            result = 0L
            shift = 0
            do {
                if (index >= encoded.length) break
                b = encoded[index++].code - 63
                result = result or ((b.toLong() and 0x1fL) shl shift)
                shift += 5
            } while (b >= 0x20 && index < encoded.length)
            val dLng = if ((result and 1L) != 0L) (result shr 1).inv() else (result shr 1)
            lng += dLng

            points.add(LatLngPoint(lat / scale, lng / scale))
        }
        return points
    }

    /**
     * Handles MethodChannel invocations for "evaluateNavigation" and "computeOffRouteCorridor".
     */
    fun handleMethodCall(method: String, arguments: Map<String, Any?>): Map<String, Any?> {
        return when (method) {
            "computeOffRouteCorridor" -> {
                val acc = (arguments["accuracy_m"] as? Number)?.toDouble() ?: 8.0
                mapOf(
                    "corridor_meters" to computeOffRouteCorridorMeters(acc),
                    "execution_mode" to EXECUTION_MODE,
                    "navigation_source" to EXECUTION_MODE,
                )
            }
            "evaluateNavigation" -> {
                val poly6 = (arguments["polyline6"] as? String) ?: ""
                val lat = (arguments["latitude"] as? Number)?.toDouble() ?: 30.0444
                val lng = (arguments["longitude"] as? Number)?.toDouble() ?: 31.2357
                val acc = (arguments["accuracy_m"] as? Number)?.toDouble() ?: 8.0
                val speed = (arguments["speed_mps"] as? Number)?.toDouble() ?: 10.0
                val userPos = LatLngPoint(lat, lng)
                val decoded = decodePolyline(poly6, 6).ifEmpty { listOf(userPos) }

                var nearestIdx = 0
                var nearestPt = decoded.first()
                var minDist = Double.POSITIVE_INFINITY
                for (i in decoded.indices) {
                    val d = haversineMeters(userPos, decoded[i])
                    if (d < minDist) {
                        minDist = d
                        nearestPt = decoded[i]
                        nearestIdx = i
                    }
                }

                val nextIdx = min(nearestIdx + 1, decoded.size - 1)
                val bearing = if (nearestIdx < nextIdx) {
                    initialBearingDegrees(decoded[nearestIdx], decoded[nextIdx])
                } else {
                    0.0
                }

                val corridor = computeOffRouteCorridorMeters(acc)
                val offRoute = minDist > corridor

                var remainingDist = 0.0
                for (i in nearestIdx until (decoded.size - 1)) {
                    remainingDist += haversineMeters(decoded[i], decoded[i + 1])
                }
                val effSpeed = max(speed, 4.0)
                val remainingDur = remainingDist / effSpeed

                val distToNextTurn = if (nearestIdx < nextIdx) {
                    haversineMeters(userPos, decoded[nextIdx])
                } else {
                    0.0
                }

                val instructionEn = (arguments["next_instruction_en"] as? String) ?: "Continue on route"
                val instructionAr = (arguments["next_instruction_ar"] as? String) ?: "استمر على المسار"

                var voiceSlot: String? = null
                var voiceEn: String? = null
                var voiceAr: String? = null
                if (!offRoute) {
                    when {
                        distToNextTurn <= 55.0 -> {
                            voiceSlot = "final"
                            voiceEn = "Now: $instructionEn"
                            voiceAr = "الآن: $instructionAr"
                        }
                        distToNextTurn <= 220.0 -> {
                            voiceSlot = "approach"
                            voiceEn = "In ${distToNextTurn.roundToInt()} meters, $instructionEn"
                            voiceAr = "بعد ${distToNextTurn.roundToInt()} متر، $instructionAr"
                        }
                        distToNextTurn <= 600.0 -> {
                            voiceSlot = "pre_announce"
                            voiceEn = "Prepare in ${distToNextTurn.roundToInt()} meters: $instructionEn"
                            voiceAr = "استعد بعد ${distToNextTurn.roundToInt()} متر: $instructionAr"
                        }
                    }
                }

                mapOf(
                    "snapped_lat" to nearestPt.latitude,
                    "snapped_lng" to nearestPt.longitude,
                    "snapped_bearing" to bearing,
                    "current_step_index" to nearestIdx,
                    "distance_to_next_turn_m" to distToNextTurn,
                    "remaining_distance_m" to remainingDist,
                    "remaining_duration_s" to remainingDur,
                    "off_route" to offRoute,
                    "off_route_corridor_m" to corridor,
                    "voice_slot" to voiceSlot,
                    "voice_en" to voiceEn,
                    "voice_ar" to voiceAr,
                    "execution_mode" to EXECUTION_MODE,
                    "navigation_source" to EXECUTION_MODE,
                )
            }
            else -> throw IllegalArgumentException("Unsupported MapTronVelaBridge method: $method")
        }
    }
}
