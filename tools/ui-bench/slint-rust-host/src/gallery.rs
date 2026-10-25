// AUTO-GENERATED from checksum-verified source manifests; edit generator, not this file.
pub fn count(media: &str) -> i32 {
    match media {
        "dune3d" => 1,
        "material-maker" => 1,
        "real-video-enhancer" => 1,
        "craft-photocraft" => 4,
        "craft-lightcraft" => 4,
        "craft-filmcraft" => 3,
        "craft-designcraft" => 1,
        "craft-vectorcraft" => 4,
        "craft-pdfcraft" => 4,
        "craft-effectcraft" => 4,
        "craft-wordcraft" => 4,
        "craft-deckcraft" => 4,
        "craft-gridcraft" => 4,
        "craft-cadcraft" => 3,
        "craft-soundcraft" => 4,
        "craft-figcraft" => 4,
        _ => 0,
    }
}

pub fn source(media: &str, index: i32) -> Option<&'static str> {
    match (media, index) {
        ("dune3d", 0) => Some("https://github.com/dune3d/dune3d/blob/d01faaf16f309e55834c3b93dddce5c852453cfe/screenshot.png"),
        ("material-maker", 0) => Some("https://github.com/RodZill4/material-maker/blob/424dec64a75478f22267ba9281a5cbe7a236b802/material_maker/doc/images/screenshot.png"),
        ("real-video-enhancer", 0) => Some("https://github.com/TNTwise/REAL-Video-Enhancer/blob/8541c46ca14e6f84fc86c5b9d3b75373e25732e5/screenshots/settings.png"),
        ("craft-photocraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/photocraft/adjustments.jpg"),
        ("craft-photocraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/photocraft/demo.jpg"),
        ("craft-photocraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/photocraft/layer-styles.jpg"),
        ("craft-photocraft", 3) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/photocraft/masks.jpg"),
        ("craft-lightcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/lightcraft/curve.jpg"),
        ("craft-lightcraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/lightcraft/grading.jpg"),
        ("craft-lightcraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/lightcraft/hero.jpg"),
        ("craft-lightcraft", 3) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/lightcraft/masking.jpg"),
        ("craft-filmcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/filmcraft/assembly.jpg"),
        ("craft-filmcraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/filmcraft/color.jpg"),
        ("craft-filmcraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/filmcraft/keyframes.jpg"),
        ("craft-designcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/designcraft/spread.jpg"),
        ("craft-vectorcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/vectorcraft/bezier.jpg"),
        ("craft-vectorcraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/vectorcraft/neon.jpg"),
        ("craft-vectorcraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/vectorcraft/ribbons.jpg"),
        ("craft-vectorcraft", 3) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/vectorcraft/sheet.jpg"),
        ("craft-pdfcraft", 0) => Some("https://github.com/storytold/pdfcraft/blob/0dc77fe4ed8810b9e9f25b9dd050afae662c062a/docs/images/pdfcraft-viewer.png"),
        ("craft-pdfcraft", 1) => Some("https://github.com/storytold/pdfcraft/blob/0dc77fe4ed8810b9e9f25b9dd050afae662c062a/docs/images/pdfcraft-dark.png"),
        ("craft-pdfcraft", 2) => Some("https://github.com/storytold/pdfcraft/blob/0dc77fe4ed8810b9e9f25b9dd050afae662c062a/docs/images/pdfcraft-forms.png"),
        ("craft-pdfcraft", 3) => Some("https://github.com/storytold/pdfcraft/blob/0dc77fe4ed8810b9e9f25b9dd050afae662c062a/docs/images/pdfcraft-organize.png"),
        ("craft-effectcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/effectcraft/3d.jpg"),
        ("craft-effectcraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/effectcraft/effects.jpg"),
        ("craft-effectcraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/effectcraft/graph.jpg"),
        ("craft-effectcraft", 3) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/effectcraft/hero.jpg"),
        ("craft-wordcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/wordcraft/design.jpg"),
        ("craft-wordcraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/wordcraft/hero.jpg"),
        ("craft-wordcraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/wordcraft/layout.jpg"),
        ("craft-wordcraft", 3) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/wordcraft/review.jpg"),
        ("craft-deckcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/deckcraft/editor.jpg"),
        ("craft-deckcraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/deckcraft/format.jpg"),
        ("craft-deckcraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/deckcraft/shape.jpg"),
        ("craft-deckcraft", 3) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/deckcraft/sorter.jpg"),
        ("craft-gridcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/gridcraft/budget.jpg"),
        ("craft-gridcraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/gridcraft/chart.jpg"),
        ("craft-gridcraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/gridcraft/hero.jpg"),
        ("craft-gridcraft", 3) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/gridcraft/pivot.jpg"),
        ("craft-cadcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/cadcraft/apartment.jpg"),
        ("craft-cadcraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/cadcraft/bracket.jpg"),
        ("craft-cadcraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/cadcraft/layout.jpg"),
        ("craft-soundcraft", 0) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/soundcraft/automation.jpg"),
        ("craft-soundcraft", 1) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/soundcraft/edit.jpg"),
        ("craft-soundcraft", 2) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/soundcraft/mix.jpg"),
        ("craft-soundcraft", 3) => Some("https://github.com/storytold/craft-launcher-assets/blob/v1/soundcraft/score.jpg"),
        ("craft-figcraft", 0) => Some("https://github.com/storytold/figcraft/blob/80f916326fb94f3a88cb24e64f396f564a0ebc06/docs/images/shot-1-hero.png"),
        ("craft-figcraft", 1) => Some("https://github.com/storytold/figcraft/blob/80f916326fb94f3a88cb24e64f396f564a0ebc06/docs/images/shot-2-components.png"),
        ("craft-figcraft", 2) => Some("https://github.com/storytold/figcraft/blob/80f916326fb94f3a88cb24e64f396f564a0ebc06/docs/images/shot-3-prototype.png"),
        ("craft-figcraft", 3) => Some("https://github.com/storytold/figcraft/blob/80f916326fb94f3a88cb24e64f396f564a0ebc06/docs/images/shot-4-devmode.png"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pinned_gallery_has_exact_50_approved_frames_and_safe_sources() {
        let all: Vec<(&str,i32)> = vec![
            ("dune3d", 1),
            ("material-maker", 1),
            ("real-video-enhancer", 1),
            ("craft-photocraft", 4),
            ("craft-lightcraft", 4),
            ("craft-filmcraft", 3),
            ("craft-designcraft", 1),
            ("craft-vectorcraft", 4),
            ("craft-pdfcraft", 4),
            ("craft-effectcraft", 4),
            ("craft-wordcraft", 4),
            ("craft-deckcraft", 4),
            ("craft-gridcraft", 4),
            ("craft-cadcraft", 3),
            ("craft-soundcraft", 4),
            ("craft-figcraft", 4),
        ];
        assert_eq!(all.iter().map(|(_,n)| n).sum::<i32>(), 50);
        for (media,n) in all {
            assert_eq!(count(media),n);
            for index in 0..n {
                assert!(source(media,index).unwrap().starts_with("https://github.com/"));
            }
            assert_eq!(source(media,n),None);
        }
        assert_eq!(count("research:unverified"),0);
        assert_eq!(source("craft-pdfcraft",99),None);
    }
}
