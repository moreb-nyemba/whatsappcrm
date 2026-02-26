from django.test import TestCase
from unittest.mock import patch, MagicMock
from io import StringIO
from django.core.management import call_command
from flows.models import WhatsAppFlow
from meta_integration.models import MetaAppConfig


class SyncWhatsAppFlowsCommandTest(TestCase):
    """Tests for the sync_whatsapp_flows management command."""

    def setUp(self):
        self.meta_config = MetaAppConfig.objects.create(
            name='Test Config',
            verify_token='test-verify',
            access_token='test-token',
            phone_number_id='12345',
            waba_id='67890',
            api_version='v19.0',
            is_active=True,
        )
        self.flow1 = WhatsAppFlow.objects.create(
            name='test_flow_1',
            friendly_name='Test Flow 1',
            flow_json={"version": "3.0", "screens": [{"id": "WELCOME", "layout": {}}]},
            meta_app_config=self.meta_config,
            sync_status='draft',
        )
        self.flow2 = WhatsAppFlow.objects.create(
            name='test_flow_2',
            friendly_name='Test Flow 2',
            flow_json={"version": "3.0", "screens": [{"id": "WELCOME", "layout": {}}]},
            meta_app_config=self.meta_config,
            sync_status='draft',
        )

    @patch('flows.whatsapp_flow_service.WhatsAppFlowService.sync_flow')
    def test_sync_all_flows(self, mock_sync):
        """Test syncing all flows."""
        mock_sync.return_value = True
        out = StringIO()
        call_command('sync_whatsapp_flows', stdout=out)
        output = out.getvalue()
        self.assertIn('Syncing 2 WhatsApp flow(s)', output)
        self.assertIn('2 succeeded, 0 failed', output)
        self.assertEqual(mock_sync.call_count, 2)

    @patch('flows.whatsapp_flow_service.WhatsAppFlowService.sync_flow')
    def test_sync_by_name(self, mock_sync):
        """Test syncing a specific flow by name."""
        mock_sync.return_value = True
        out = StringIO()
        call_command('sync_whatsapp_flows', name='test_flow_1', stdout=out)
        output = out.getvalue()
        self.assertIn('Syncing 1 WhatsApp flow(s)', output)
        self.assertEqual(mock_sync.call_count, 1)

    @patch('flows.whatsapp_flow_service.WhatsAppFlowService.sync_flow')
    def test_sync_draft_only(self, mock_sync):
        """Test syncing only draft/error flows."""
        self.flow2.sync_status = 'synced'
        self.flow2.save()
        mock_sync.return_value = True
        out = StringIO()
        call_command('sync_whatsapp_flows', draft_only=True, stdout=out)
        output = out.getvalue()
        self.assertIn('Syncing 1 WhatsApp flow(s)', output)
        self.assertEqual(mock_sync.call_count, 1)

    @patch('flows.whatsapp_flow_service.WhatsAppFlowService.sync_flow')
    def test_sync_with_failure(self, mock_sync):
        """Test that failures are counted correctly."""
        mock_sync.side_effect = [True, False]
        out = StringIO()
        call_command('sync_whatsapp_flows', stdout=out)
        output = out.getvalue()
        self.assertIn('1 succeeded, 1 failed', output)

    def test_no_flows_found(self):
        """Test command output when no flows match criteria."""
        out = StringIO()
        call_command('sync_whatsapp_flows', name='nonexistent', stdout=out)
        output = out.getvalue()
        self.assertIn('No WhatsApp flows found', output)

    @patch('flows.whatsapp_flow_service.WhatsAppFlowService.publish_flow')
    @patch('flows.whatsapp_flow_service.WhatsAppFlowService.sync_flow')
    def test_sync_and_publish(self, mock_sync, mock_publish):
        """Test syncing and publishing flows."""
        mock_sync.return_value = True
        mock_publish.return_value = True
        # Set flow_id so publish can work
        self.flow1.flow_id = 'meta_123'
        self.flow1.save()
        self.flow2.flow_id = 'meta_456'
        self.flow2.save()
        out = StringIO()
        call_command('sync_whatsapp_flows', publish=True, stdout=out)
        output = out.getvalue()
        self.assertIn('2 succeeded, 0 failed', output)


class WhatsAppFlowViewSetSyncAllTest(TestCase):
    """Tests for the sync_all action on WhatsAppFlowViewSet."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.user = User.objects.create_user(username='testuser', password='testpass')

        self.meta_config = MetaAppConfig.objects.create(
            name='Test Config',
            verify_token='test-verify',
            access_token='test-token',
            phone_number_id='12345',
            waba_id='67890',
            api_version='v19.0',
            is_active=True,
        )
        self.flow1 = WhatsAppFlow.objects.create(
            name='test_flow_1',
            flow_json={"version": "3.0", "screens": [{"id": "WELCOME", "layout": {}}]},
            meta_app_config=self.meta_config,
            sync_status='draft',
        )

    @patch('flows.whatsapp_flow_service.WhatsAppFlowService.sync_flow')
    def test_sync_all_endpoint(self, mock_sync):
        """Test the sync_all API endpoint."""
        mock_sync.return_value = True
        self.client.force_login(self.user)
        response = self.client.post(
            '/crm-api/flows/whatsapp-flows/sync_all/',
            data='{}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['total'], 1)
        self.assertEqual(data['succeeded'], 1)
        self.assertEqual(data['failed'], 0)

    @patch('flows.whatsapp_flow_service.WhatsAppFlowService.sync_flow')
    def test_sync_all_with_failure(self, mock_sync):
        """Test sync_all endpoint when sync fails."""
        mock_sync.return_value = False
        self.client.force_login(self.user)
        response = self.client.post(
            '/crm-api/flows/whatsapp-flows/sync_all/',
            data='{}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['total'], 1)
        self.assertEqual(data['succeeded'], 0)
        self.assertEqual(data['failed'], 1)

    def test_sync_all_requires_auth(self):
        """Test that sync_all requires authentication."""
        response = self.client.post(
            '/crm-api/flows/whatsapp-flows/sync_all/',
            data='{}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 401)
