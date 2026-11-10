import os, tempfile, unittest
from lsmkv.manifest import State, load, save

class ManifestTest(unittest.TestCase):
    def test_save_load_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            save(tmp, State(next_file=5, tables=[4, 2, 1]))
            st = load(tmp)
            self.assertEqual(st.next_file, 5)
            self.assertEqual(st.tables, [4, 2, 1])
            self.assertTrue(os.path.exists(os.path.join(tmp, "MANIFEST")))

    def test_atomic_replace(self):
        with tempfile.TemporaryDirectory() as tmp:
            save(tmp, State(next_file=2, tables=[1]))
            save(tmp, State(next_file=3, tables=[2, 1]))
            st = load(tmp)
            self.assertEqual(st.tables, [2, 1])

if __name__ == "__main__":
    unittest.main()
