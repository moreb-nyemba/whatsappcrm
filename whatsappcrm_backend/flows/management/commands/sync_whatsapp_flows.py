from django.core.management.base import BaseCommand
from flows.models import WhatsAppFlow
from flows.whatsapp_flow_service import WhatsAppFlowService

import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        'Sync WhatsApp UI flows with Meta. '
        'By default syncs all flows. Use --name to sync a specific flow. '
        'Use --publish to also publish after syncing.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--name',
            type=str,
            help='Sync only the WhatsApp flow with this name.',
        )
        parser.add_argument(
            '--publish',
            action='store_true',
            help='Also publish flows after syncing.',
        )
        parser.add_argument(
            '--draft-only',
            action='store_true',
            help='Only sync flows that are in draft or error status.',
        )

    def handle(self, *args, **options):
        flow_name = options.get('name')
        publish = options.get('publish', False)
        draft_only = options.get('draft_only', False)

        queryset = WhatsAppFlow.objects.select_related('meta_app_config').all()

        if flow_name:
            queryset = queryset.filter(name=flow_name)
        if draft_only:
            queryset = queryset.filter(sync_status__in=['draft', 'error'])

        flows = list(queryset)

        if not flows:
            self.stdout.write(self.style.WARNING('No WhatsApp flows found matching the criteria.'))
            return

        self.stdout.write(self.style.SUCCESS(
            f'--- Syncing {len(flows)} WhatsApp flow(s) ---'
        ))

        success_count = 0
        error_count = 0

        for whatsapp_flow in flows:
            self.stdout.write(f'\nProcessing: {whatsapp_flow.name} (status: {whatsapp_flow.sync_status})')

            try:
                service = WhatsAppFlowService(whatsapp_flow.meta_app_config)
                sync_ok = service.sync_flow(whatsapp_flow)

                if sync_ok:
                    self.stdout.write(self.style.SUCCESS(
                        f'  ✅ Synced "{whatsapp_flow.name}" (Meta ID: {whatsapp_flow.flow_id})'
                    ))

                    if publish:
                        whatsapp_flow.refresh_from_db()
                        pub_ok = service.publish_flow(whatsapp_flow)
                        if pub_ok:
                            self.stdout.write(self.style.SUCCESS(
                                f'  ✅ Published "{whatsapp_flow.name}"'
                            ))
                        else:
                            whatsapp_flow.refresh_from_db()
                            self.stdout.write(self.style.ERROR(
                                f'  ❌ Publish failed for "{whatsapp_flow.name}": '
                                f'{whatsapp_flow.sync_error}'
                            ))
                            error_count += 1
                            continue

                    success_count += 1
                else:
                    whatsapp_flow.refresh_from_db()
                    self.stdout.write(self.style.ERROR(
                        f'  ❌ Sync failed for "{whatsapp_flow.name}": '
                        f'{whatsapp_flow.sync_error}'
                    ))
                    error_count += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'  ❌ Error processing "{whatsapp_flow.name}": {e}'
                ))
                error_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'\n--- Finished: {success_count} succeeded, {error_count} failed ---'
        ))
