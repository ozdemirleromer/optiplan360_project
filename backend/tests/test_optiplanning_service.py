import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

from app.models import Order, OrderPart
from app.services.optiplanning_service import OptiPlanningService


class TestOptiPlanningService(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.service = OptiPlanningService(export_dir=self.test_dir, optiplan_exe="dummy.exe")

        self.part_govde_1 = OrderPart(
            id="part1",
            part_group="GOVDE",
            boy_mm=1000,
            en_mm=500,
            adet=2,
            u1="1mm",
            u2="1mm",
            k1="040",
            k2="040",
        )
        self.part_govde_2 = OrderPart(
            id="part2",
            part_group="GOVDE",
            boy_mm=800,
            en_mm=400,
            adet=4,
            u1="1mm",
            u2=None,
            k1="040",
            k2=None,
        )
        self.part_arkalik_1 = OrderPart(
            id="part3",
            part_group="ARKALIK",
            boy_mm=1000,
            en_mm=500,
            adet=1,
            u1="1mm",
            u2="1mm",
        )
        self.mock_order = Order(
            id="order1",
            customer_id=1,
            crm_name_snapshot="Test Customer",
            thickness_mm=18,
            color="Beyaz",
            parts=[self.part_govde_1, self.part_govde_2, self.part_arkalik_1],
        )

    @patch("app.services.optiplanning_service.generate_xlsx_for_job")
    @patch("app.services.order_service.OrderService.get_order")
    def test_export_order_delegates_to_canonical_generator(self, mock_get_order, mock_generate):
        mock_get_order.return_value = self.mock_order
        mock_generate.return_value = ["govde.xlsx", "arkalik.xlsx"]

        generated_files = self.service.export_order(
            db=None,
            order_id="order1",
            format_type="EXCEL",
            trigger_exe=False,
        )

        self.assertEqual(generated_files, ["govde.xlsx", "arkalik.xlsx"])
        mock_generate.assert_called_once()

        export_context, parts, export_dir = mock_generate.call_args.args
        self.assertEqual(export_context.order_id, "order1")
        self.assertEqual(export_context.customer_snapshot_name, "Test Customer")
        self.assertEqual(parts, list(self.mock_order.parts))
        self.assertEqual(export_dir, self.service.export_dir)

    @patch("app.services.order_service.OrderService.get_order")
    def test_export_order_excel(self, mock_get_order):
        mock_get_order.return_value = self.mock_order

        generated_files = self.service.export_order(
            db=None,
            order_id="order1",
            format_type="EXCEL",
            trigger_exe=False,
        )

        self.assertEqual(len(generated_files), 2)

        govde_file = [f for f in generated_files if "GOVDE" in f][0]
        arkalik_file = [f for f in generated_files if "ARKALIK" in f][0]

        self.assertTrue(os.path.exists(govde_file))
        self.assertTrue(os.path.exists(arkalik_file))

        df_ark = pd.read_excel(arkalik_file, header=0)
        self.assertEqual(len(df_ark), 1)
        self.assertTrue(pd.isna(df_ark.iloc[0]["TOP_EDGE"]) or str(df_ark.iloc[0]["TOP_EDGE"]) == "")
        self.assertTrue(
            pd.isna(df_ark.iloc[0]["BOTTOM_EDGE"]) or str(df_ark.iloc[0]["BOTTOM_EDGE"]) == ""
        )

        df_govde = pd.read_excel(govde_file, header=0)
        self.assertEqual(len(df_govde), 2)
        govde_top = df_govde.iloc[0]["TOP_EDGE"]
        self.assertIn(str(govde_top), ("1", "1.0"))


def test_optiplanning_service_legacy_template_helpers_removed():
    source = Path(__file__).resolve().parents[1] / "app" / "services" / "optiplanning_service.py"
    text = source.read_text(encoding="utf-8")

    assert "def _group_parts(" not in text
    assert "def _generate_excel(" not in text
