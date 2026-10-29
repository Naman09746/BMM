import unittest
from backend.server import ProjectIn, SiteContentIn

class ProjectValidationTests(unittest.TestCase):
    def test_project_in_valid(self):
        data = {
            "title": "Test Villa",
            "slug": "test-villa",
            "segment": "MARBLE & STONE",
            "category": "Residential",
            "image": "photo-12345",
            "gallery": ["photo-12345", "photo-67890"],
            "year": "2024",
            "location": "Goa",
            "description": "Luxury seafront villa",
            "challenge": "High humidity",
            "approach": "Breathable stone",
            "outcomes": [["10", "villas"]],
            "credits": ["BDS Marvel"],
            "is_active": True,
        }
        obj = ProjectIn(**data)
        self.assertEqual(obj.title, "Test Villa")
        self.assertEqual(obj.slug, "test-villa")

    def test_site_content_in_valid(self):
        data = {
            "approach": [{"number": "01", "title": "TEST", "image": "photo-1", "text": "desc"}],
            "clients": [{"name": "Client A", "logo": "/logo.webp"}]
        }
        obj = SiteContentIn(**data)
        self.assertEqual(len(obj.approach), 1)
        self.assertEqual(len(obj.clients), 1)

if __name__ == "__main__":
    unittest.main()
