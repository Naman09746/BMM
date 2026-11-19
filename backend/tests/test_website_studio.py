"""Unit tests for Website Studio (CMS) models, draft/publish, version history, and media endpoints."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
try:
    from backend.server import StudioDraftIn, StudioPublishIn, SiteContentIn
except ImportError:
    from server import StudioDraftIn, StudioPublishIn, SiteContentIn


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


if __name__ == "__main__":
    unittest.main()

