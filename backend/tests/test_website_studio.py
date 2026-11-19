"""Unit tests for Website Studio (CMS) models, draft/publish, version history, and media endpoints."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
try:
    from backend.server import StudioDraftIn, StudioPublishIn, SiteContentIn, _magic_ok, _MIME_TYPES
except ImportError:
    from server import StudioDraftIn, StudioPublishIn, SiteContentIn, _magic_ok, _MIME_TYPES


class WebsiteStudioModelTests(unittest.TestCase):
    def test_studio_draft_in_valid(self):
        content = {
            "hero": {"eyebrow": "STUDIO EYEBROW", "title_1": "Custom Architecture"},
            "seo": {"home": {"title": "BDS Marvel Home", "description": "Custom SEO"}}
        }
        draft = StudioDraftIn(content=content)
        self.assertEqual(draft.content["hero"]["eyebrow"], "STUDIO EYEBROW")
        self.assertEqual(draft.content["seo"]["home"]["title"], "BDS Marvel Home")

    def test_studio_publish_in_defaults(self):
        pub = StudioPublishIn()
        self.assertEqual(pub.note, "Published via Website Studio")
        self.assertIsNone(pub.content)

    def test_studio_publish_in_custom_note(self):
        pub = StudioPublishIn(note="Hero video change & new stay", content={"hero": {"title_1": "New Title"}})
        self.assertEqual(pub.note, "Hero video change & new stay")
        self.assertEqual(pub.content["hero"]["title_1"], "New Title")

    def test_site_content_in_with_seo(self):
        data = {
            "hero": {"title_1": "Architecture."},
            "seo": {
                "home": {
                    "title": "BDS Marvel · Architecture & Interiors",
                    "description": "Design and build studio",
                    "keywords": "marble, interiors, luxury stays"
                }
            }
        }
        obj = SiteContentIn(**data)
        self.assertEqual(obj.seo["home"]["title"], "BDS Marvel · Architecture & Interiors")

    def test_svg_magic_validation(self):
        self.assertIn("svg", _MIME_TYPES)
        self.assertEqual(_MIME_TYPES["svg"], "image/svg+xml")
        valid_svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>'
        self.assertTrue(_magic_ok("svg", valid_svg))
        xml_svg = b'<?xml version="1.0"?><svg viewBox="0 0 100 100"><path d="M0,0"/></svg>'
        self.assertTrue(_magic_ok("svg", xml_svg))
        malicious_svg = b'<svg><script>alert(1)</script></svg>'
        self.assertFalse(_magic_ok("svg", malicious_svg))

    def test_webp_and_raster_validation(self):
        png_magic = b'\x89PNG\r\n\x1a\n' + b'rest_of_png'
        self.assertTrue(_magic_ok("png", png_magic))
        jpg_magic = b'\xff\xd8\xff\xe0'
        self.assertTrue(_magic_ok("jpg", jpg_magic))
        webp_magic = b'RIFF\x00\x00\x00\x00WEBPVP8L'
        self.assertTrue(_magic_ok("webp", webp_magic))


if __name__ == "__main__":
    unittest.main()

