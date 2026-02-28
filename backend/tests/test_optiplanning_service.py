import os
import unittest
from unittest.mock import MagicMock, patch
import pandas as pd
import tempfile

from app.models import Order, OrderPart
from app.services.optiplanning_service import OptiPlanningService

class TestOptiPlanningService(unittest.TestCase):
    def setUp(self):
        # Temp dir for exports
        self.test_dir = tempfile.mkdtemp()
        self.service = OptiPlanningService(export_dir=self.test_dir, optiplan_exe="dummy.exe")
        
        # Mock parts
        self.part_govde_1 = OrderPart(
            id="part1", part_group="GOVDE", boy_mm=1000, en_mm=500, adet=2, 
            u1="1mm", u2="1mm", k1="040", k2="040"
        )
        self.part_govde_2 = OrderPart(
            id="part2", part_group="GOVDE", boy_mm=800, en_mm=400, adet=4, 
            u1="1mm", u2=None, k1="040", k2=None
        )
        self.part_arkalik_1 = OrderPart(
            id="part3", part_group="ARKALIK", boy_mm=1000, en_mm=500, adet=1,
            u1="1mm", u2="1mm" # Should be ignored in export
        )
        # Assuming order thickness applies to govde, and arkalik gets a fixed or diff thickness
        self.mock_order = Order(
            id="order1", customer_id=1, crm_name_snapshot="Test Customer", thickness_mm=18, color="Beyaz",
            parts=[self.part_govde_1, self.part_govde_2, self.part_arkalik_1]
        )

    def test_group_parts(self):
        # Run grouping
        groups = self.service._group_parts(self.mock_order)
        
        # We should have 2 groups: One for GOVDE (18mm, Beyaz) and one for ARKALIK (8mm by fallback, Beyaz)
        self.assertEqual(len(groups), 2)
        
        meta1, items1 = list(groups.items())[0]
        meta2, items2 = list(groups.items())[1]
        
        # Convert frozenset back to dict for easy assertion
        meta1_dict = dict(meta1)
        meta2_dict = dict(meta2)
        
        if meta1_dict['part_group'] == 'GOVDE':
            govde_grp = meta1_dict
            govde_items = items1
            ark_grp = meta2_dict
            ark_items = items2
        else:
            govde_grp = meta2_dict
            govde_items = items2
            ark_grp = meta1_dict
            ark_items = items1
            
        self.assertEqual(govde_grp['part_group'], 'GOVDE')
        self.assertEqual(govde_grp['thickness'], 18)
        self.assertEqual(len(govde_items), 2)
        
        self.assertEqual(ark_grp['part_group'], 'ARKALIK')
        self.assertEqual(ark_grp['thickness'], 8) # Fallback testing
        self.assertEqual(len(ark_items), 1)

    @patch('app.services.order_service.OrderService.get_order')
    def test_export_order_excel(self, mock_get_order):
        mock_get_order.return_value = self.mock_order
        
        # We don't need a real db session for the mock
        generated_files = self.service.export_order(db=None, order_id="order1", format_type="EXCEL", trigger_exe=False)
        
        # Expecting 2 files
        self.assertEqual(len(generated_files), 2)
        
        govde_file = [f for f in generated_files if "GOVDE" in f][0]
        arkalik_file = [f for f in generated_files if "ARKALIK" in f][0]
        
        self.assertTrue(os.path.exists(govde_file))
        self.assertTrue(os.path.exists(arkalik_file))
        
        # Template-based export: row 1 tag, row 2 header, row 3+ data
        df_ark = pd.read_excel(arkalik_file, header=1)
        self.assertEqual(len(df_ark), 1)
        
        # Arkalikta bant kolonlari her zaman bos olmali
        self.assertTrue(pd.isna(df_ark.iloc[0]['P_EDGE_MAT_UP']))
        self.assertTrue(pd.isna(df_ark.iloc[0]['P_EGDE_MAT_LO']))
        
        df_govde = pd.read_excel(govde_file, header=1)
        self.assertEqual(len(df_govde), 2)
        self.assertEqual(float(df_govde.iloc[0]['P_EDGE_MAT_UP']), 1.0)
