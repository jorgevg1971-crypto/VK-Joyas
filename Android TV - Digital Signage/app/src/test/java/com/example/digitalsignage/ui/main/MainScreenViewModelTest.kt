package com.example.digitalsignage.ui.main

import com.example.digitalsignage.PlaylistRoot
import com.example.digitalsignage.PlaylistItem
import junit.framework.TestCase.assertEquals
import org.junit.Test
import kotlinx.serialization.json.Json

class MainScreenViewModelTest {

  @Test
  fun testJsonParsing() {
    val jsonString = """
      {
        "power_schedule": {
          "enabled": true,
          "on_time": "08:00",
          "off_time": "20:00",
          "days": "lun,mar,mie"
        },
        "items": [
          {
            "layout": "fullscreen",
            "file": "test.png",
            "main_file": "test.png",
            "sidebar_file": null,
            "ticker_text": null,
            "duration": 12,
            "schedule": null,
            "days": null,
            "zoom": null,
            "sidebar_zoom": null
          }
        ]
      }
    """.trimIndent()

    val leniencyJson = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        explicitNulls = true
    }

    val root = leniencyJson.decodeFromString<PlaylistRoot>(jsonString)
    assertEquals(true, root.power_schedule?.enabled)
    assertEquals(1, root.items.size)
    assertEquals("test.png", root.items[0].main_file)
  }

  @Test
  fun testJsonParsingArrayFallback() {
    val jsonString = """
      [
        {
          "layout": "fullscreen",
          "file": "test.png",
          "main_file": "test.png",
          "duration": 12
        }
      ]
    """.trimIndent()

    val leniencyJson = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        explicitNulls = true
    }

    val items = if (jsonString.trim().startsWith("{")) {
        val root = leniencyJson.decodeFromString<PlaylistRoot>(jsonString)
        root.items
    } else {
        leniencyJson.decodeFromString<List<PlaylistItem>>(jsonString)
    }
    assertEquals(1, items.size)
    assertEquals("test.png", items[0].main_file)
  }
}
