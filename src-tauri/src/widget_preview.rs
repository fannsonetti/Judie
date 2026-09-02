//! Canonical widget sizes, deterministic fixtures, and preview scale math.
//! Preview is a presentation layer over the shared WidgetFace renderer.

pub const SMALL: (u32, u32) = (240, 240);
pub const MEDIUM: (u32, u32) = (480, 240);
pub const LARGE: (u32, u32) = (480, 480);
pub const STAGE: (u32, u32) = (240, 240);

/// Linear scale that fits Large into the 240×240 editor stage.
pub const PREVIEW_STAGE_SCALE: f32 = 0.5;

pub const KINDS: &[&str] = &[
    "activity",
    "calendar",
    "climate",
    "lights",
    "media",
    "purifier",
    "quickControls",
    "server",
    "system",
    "timers",
    "weather",
    "custom",
];

pub const SIZES: &[&str] = &["1x1", "1x2", "2x2"];

pub fn canonical(size: &str) -> (u32, u32) {
    match size {
        "1x2" => MEDIUM,
        "2x2" => LARGE,
        _ => SMALL,
    }
}

pub fn scaled_box(size: &str, scale: f32) -> (u32, u32) {
    let (w, h) = canonical(size);
    ((w as f32 * scale).round() as u32, (h as f32 * scale).round() as u32)
}

pub fn aspect(size: &str) -> f32 {
    let (w, h) = canonical(size);
    w as f32 / h as f32
}

/// Frozen sample strings used by WidgetFace when `sample` is true.
pub fn fixture_values(kind: &str) -> &'static [(&'static str, &'static str)] {
    let _ = kind;
    &[
        ("weather-loc", "Hafnarfjörður"),
        ("weather-temp", "18°"),
        ("weather-cond", "Cloudy"),
        ("month", "March"),
        ("track", "Night Drive"),
        ("artist", "Analog Heart"),
        ("indoor", "21°"),
        ("cpu", "24"),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_has_three_sizes_and_a_fixture() {
        for kind in KINDS {
            assert!(!fixture_values(kind).is_empty(), "{kind}");
            for size in SIZES {
                let (w, h) = canonical(size);
                assert!(w > 0 && h > 0);
                let (pw, ph) = scaled_box(size, 1.0);
                assert_eq!((pw, ph), (w, h), "1:1 preview must match placed canonical {kind} {size}");
            }
        }
    }

    #[test]
    fn scale_is_uniform_pixel_aligned_and_keeps_aspect() {
        for size in SIZES {
            let (cw, ch) = canonical(size);
            let (pw, ph) = scaled_box(size, PREVIEW_STAGE_SCALE);
            assert_eq!(pw, cw / 2);
            assert_eq!(ph, ch / 2);
            assert!((aspect(size) - pw as f32 / ph as f32).abs() < 1e-6);
            assert!(pw <= STAGE.0 && ph <= STAGE.1);
        }
        let small = scaled_box("1x1", PREVIEW_STAGE_SCALE);
        let medium = scaled_box("1x2", PREVIEW_STAGE_SCALE);
        let large = scaled_box("2x2", PREVIEW_STAGE_SCALE);
        assert_eq!(small, (120, 120));
        assert_eq!(medium, (240, 120));
        assert_eq!(large, (240, 240));
        assert_eq!(small.0 * 2, large.0);
        assert_eq!(medium.0, large.0);
        assert_eq!(medium.1 * 2, large.1);
    }

    #[test]
    fn fixtures_are_deterministic() {
        assert_eq!(fixture_values("weather"), fixture_values("weather"));
        let joined = fixture_values("calendar")
            .iter()
            .map(|(_, v)| *v)
            .collect::<String>();
        assert!(!joined.contains("std::"), "fixture must not call time");
    }
}
