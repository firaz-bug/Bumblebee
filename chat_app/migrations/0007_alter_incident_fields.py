from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('chat_app', '0006_knowledgebase'),
    ]

    operations = [
        migrations.RenameField(
            model_name='incident',
            old_name='title',
            new_name='short_description',
        ),
        migrations.RenameField(
            model_name='incident',
            old_name='description',
            new_name='long_description',
        ),
        migrations.RenameField(
            model_name='incident',
            old_name='severity',
            new_name='priority',
        ),
        migrations.RemoveField(
            model_name='incident',
            name='status',
        ),
        migrations.AddField(
            model_name='incident',
            name='incident_number',
            field=models.CharField(default='INC000', max_length=50),
            preserve_default=False,
        ),
    ]