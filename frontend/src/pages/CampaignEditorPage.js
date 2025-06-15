import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Layout, Card, Typography, Spin, Alert, Steps, Button, Form, Input, Radio, Select, DatePicker, Row, Col, Popover, message as antdMessage, Empty } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeftOutlined, SaveOutlined, SendOutlined, FieldTimeOutlined } from '@ant-design/icons';
import { Editor } from '@tinymce/tinymce-react'; // Assuming TinyMCE is for preview, not main editing here based on V1.1 scope
import dayjs from 'dayjs'; // For DatePicker default values and formatting

import {
  fetchCampaignById,
  createCampaign,
  updateCampaign,
  sendCampaignNow,
  scheduleCampaign,
  resetWizard,
  setWizardStep,
  updateWizardData,
  loadCampaignIntoWizard,
  selectCampaignWizardState,
  selectCurrentCampaignData,
  selectCampaignsLoading,
  selectCampaignsSubmitting,
  selectCampaignsError,
} from '../store/slices/campaignsSlice';

import { fetchContacts, selectContacts, selectContactsPagination, selectContactsLoading as selectContactsListLoading } from '../store/slices/contactsSlice';
import { fetchTemplates, selectAllTemplates, selectTemplatesLoading as selectTemplatesListLoading } from '../store/slices/templatesSlice';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;

const CampaignEditorPage = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [formStep1] = Form.useForm();
  const [formStep2] = Form.useForm();
  const [formStep3] = Form.useForm();
  const [formStep4] = Form.useForm();


  // Campaign Slice selectors
  const wizardState = useSelector(selectCampaignWizardState);
  const currentCampaignForEdit = useSelector(selectCurrentCampaignData); // Used to check if edit data is loaded
  const isLoadingCampaign = useSelector(selectCampaignsLoading); // Loading existing campaign
  const isSubmittingCampaign = useSelector(selectCampaignsSubmitting); // Saving/sending/scheduling
  const campaignError = useSelector(selectCampaignsError);

  // Contacts Slice selectors
  const contactsList = useSelector(selectContacts);
  const contactsPagination = useSelector(selectContactsPagination);
  const isLoadingContacts = useSelector(selectContactsListLoading);

  // Templates Slice selectors
  const templatesList = useSelector(selectAllTemplates);
  const isLoadingTemplates = useSelector(selectTemplatesListLoading);

  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');

  const isEditing = !!campaignId;
  const { currentStep, campaignData } = wizardState;

  // Debounce search for contacts and templates
  const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  };

  const debouncedContactSearch = useCallback(debounce((searchTerm) => {
    dispatch(fetchContacts({ page: 1, pageSize: 20, search: searchTerm }));
  }, 500), [dispatch]);

  const debouncedTemplateSearch = useCallback(debounce((searchTerm) => {
    dispatch(fetchTemplates({ page: 1, pageSize: 20, search: searchTerm })); // Assuming templates can be searched
  }, 500), [dispatch]);


  // Fetch initial data for selects
  useEffect(() => {
    dispatch(fetchContacts({ page: 1, pageSize: 20, search: '' })); // Initial load
    dispatch(fetchTemplates({ page: 1, pageSize: 20, search: '' })); // Initial load
  }, [dispatch]);


  // Load campaign data if in edit mode
  useEffect(() => {
    if (isEditing) {
      dispatch(fetchCampaignById(campaignId));
    } else {
      dispatch(resetWizard()); // Ensure wizard is fresh for new campaign
    }
    return () => {
      dispatch(resetWizard()); // Cleanup on unmount
    };
  }, [dispatch, campaignId, isEditing]);

  // Set form values when campaignData in Redux store changes (e.g., after fetching for edit)
   useEffect(() => {
    if (campaignData) {
      formStep1.setFieldsValue({ name: campaignData.name, subject: campaignData.subject });
      formStep2.setFieldsValue({
        recipient_group_type: campaignData.recipient_group?.type || 'all_contacts',
        specific_contact_ids: campaignData.recipient_group?.type === 'specific_ids' ? campaignData.recipient_group.ids : [],
      });
      formStep3.setFieldsValue({ template_id: campaignData.template_id });
      formStep4.setFieldsValue({ scheduled_at: campaignData.scheduled_at ? dayjs(campaignData.scheduled_at) : null });
    }
  }, [campaignData, formStep1, formStep2, formStep3, formStep4]);


  const handleNext = async () => {
    try {
      if (currentStep === 1) await formStep1.validateFields();
      if (currentStep === 2) await formStep2.validateFields();
      if (currentStep === 3) await formStep3.validateFields();
      dispatch(setWizardStep(currentStep + 1));
    } catch (errorInfo) {
      console.log('Validation Failed:', errorInfo);
    }
  };

  const handlePrev = () => {
    dispatch(setWizardStep(currentStep - 1));
  };

  // Update Redux store when form field values change
  const handleFormValuesChange = (changedValues, allValues, formName) => {
    if (formName === 'step1') dispatch(updateWizardData({ ...changedValues }));
    if (formName === 'step2') {
        const { recipient_group_type, specific_contact_ids } = allValues;
        if (recipient_group_type === 'all_contacts') {
            dispatch(updateWizardData({ recipient_group: { type: 'all_contacts', ids: [] } }));
        } else {
            dispatch(updateWizardData({ recipient_group: { type: 'specific_ids', ids: specific_contact_ids || [] } }));
        }
    }
    if (formName === 'step3') dispatch(updateWizardData({ template_id: allValues.template_id }));
    // Step 4 (scheduling) is handled directly on submit actions
  };


  const handleSubmitCampaign = async (actionType, scheduleTime = null) => {
    try {
      await formStep4.validateFields(); // Validate current step if any, or ensure all data is valid

      const finalCampaignData = {
        name: campaignData.name,
        subject: campaignData.subject,
        recipient_group: campaignData.recipient_group,
        template_id: campaignData.template_id,
        // Status will be set by backend based on action
      };
      if (scheduleTime) {
        finalCampaignData.scheduled_at = dayjs(scheduleTime).toISOString();
      }

      let campaignActionResult;
      if (isEditing) {
        campaignActionResult = await dispatch(updateCampaign({ campaignId, campaignData: finalCampaignData }));
      } else {
        campaignActionResult = await dispatch(createCampaign(finalCampaignData));
      }

      if (createCampaign.fulfilled.match(campaignActionResult) || updateCampaign.fulfilled.match(campaignActionResult)) {
        const savedCampaignId = campaignActionResult.payload.id;
        if (actionType === 'send') {
          const sendResult = await dispatch(sendCampaignNow(savedCampaignId));
           if (sendCampaignNow.fulfilled.match(sendResult)) antdMessage.success('Campaign sent successfully!');
           else antdMessage.error(sendResult.payload || 'Failed to send campaign.');
        } else if (actionType === 'schedule') {
          // scheduleCampaign thunk is not used here if scheduled_at is part of main campaign data
          // If schedule is a separate action AFTER create/update:
          // const scheduleResult = await dispatch(scheduleCampaign({ campaignId: savedCampaignId, scheduled_at: finalCampaignData.scheduled_at }));
          // if (scheduleCampaign.fulfilled.match(scheduleResult)) antdMessage.success('Campaign scheduled successfully!');
          // else antdMessage.error(scheduleResult.payload || 'Failed to schedule campaign.');
          antdMessage.success(`Campaign ${isEditing ? 'updated and' : 'created and'} scheduled successfully!`);
        } else { // Save as draft
             antdMessage.success(`Campaign ${isEditing ? 'updated' : 'created'} as draft!`);
        }
        navigate('/campaigns');
      } else {
        antdMessage.error(campaignActionResult.payload || `Failed to ${isEditing ? 'update' : 'create'} campaign.`);
      }
    } catch (errorInfo) {
      console.log('Submit Validation Failed:', errorInfo);
      antdMessage.error('Please check the form for errors.');
    }
  };

  const selectedTemplate = useMemo(() => {
    if (campaignData.template_id && templatesList) {
      return templatesList.find(t => t.id === campaignData.template_id);
    }
    return null;
  }, [campaignData.template_id, templatesList]);


  // Step Content
  const steps = [
    {
      title: 'Setup',
      content: (
        <Form form={formStep1} layout="vertical" name="step1" onValuesChange={(c,a) => handleFormValuesChange(c,a,'step1')} initialValues={campaignData}>
          <Form.Item name="name" label="Campaign Name" rules={[{ required: true, message: 'Please input the campaign name!' }]}>
            <Input placeholder="e.g., Monthly Newsletter - September" />
          </Form.Item>
          <Form.Item name="subject" label="Email Subject" rules={[{ required: true, message: 'Please input the email subject!' }]}>
            <Input placeholder="e.g., Exciting News & Updates This Month!" />
          </Form.Item>
        </Form>
      ),
    },
    {
      title: 'Recipients',
      content: (
        <Form form={formStep2} layout="vertical" name="step2" onValuesChange={(c,a) => handleFormValuesChange(c,a,'step2')} initialValues={{recipient_group_type: campaignData.recipient_group?.type || 'all_contacts', specific_contact_ids: campaignData.recipient_group?.ids || []}}>
          <Form.Item name="recipient_group_type" label="Select Recipient Group">
            <Radio.Group>
              <Radio value="all_contacts">All Contacts</Radio>
              <Radio value="specific_ids">Specific Contacts</Radio>
              {/* Future: <Radio value="segment">Segment</Radio> */}
            </Radio.Group>
          </Form.Item>
          {formStep2.getFieldValue('recipient_group_type') === 'specific_ids' && (
            <Form.Item name="specific_contact_ids" label="Choose Contacts" rules={[{ required: true, message: 'Please select at least one contact!' }]}>
              <Select
                mode="multiple"
                showSearch
                placeholder="Search and select contacts"
                loading={isLoadingContacts}
                onSearch={(value) => { setContactSearchTerm(value); debouncedContactSearch(value); }}
                filterOption={false} // Server-side search
                notFoundContent={isLoadingContacts ? <Spin size="small" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              >
                {contactsList.map(contact => <Option key={contact.id} value={contact.id}>{contact.email} ({contact.first_name} {contact.last_name})</Option>)}
              </Select>
            </Form.Item>
          )}
        </Form>
      ),
    },
    {
      title: 'Template',
      content: (
        <Form form={formStep3} layout="vertical" name="step3" onValuesChange={(c,a) => handleFormValuesChange(c,a,'step3')} initialValues={{template_id: campaignData.template_id}}>
          <Form.Item name="template_id" label="Select Email Template" rules={[{ required: true, message: 'Please select a template!' }]}>
            <Select
              showSearch
              placeholder="Search and select a template"
              loading={isLoadingTemplates}
              onSearch={(value) => {setTemplateSearchTerm(value); debouncedTemplateSearch(value);}}
              filterOption={false}
              notFoundContent={isLoadingTemplates ? <Spin size="small" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            >
              {templatesList.map(template => <Option key={template.id} value={template.id}>{template.name}</Option>)}
            </Select>
          </Form.Item>
          {selectedTemplate && (
            <Card title="Template Preview (Simplified)" size="small" style={{marginTop: 16}}>
              <Title level={5}>Subject: {selectedTemplate.subject}</Title>
              <Paragraph>Body Preview:</Paragraph>
              <div style={{ border: '1px solid #f0f0f0', padding: 10, maxHeight: 300, overflowY: 'auto', backgroundColor: '#fafafa' }}>
                 <div dangerouslySetInnerHTML={{ __html: selectedTemplate.body_html || '<p>No content</p>' }} />
              </div>
            </Card>
          )}
        </Form>
      ),
    },
    {
      title: 'Review & Schedule',
      content: (
        <Form form={formStep4} layout="vertical" name="step4" initialValues={{scheduled_at: campaignData.scheduled_at ? dayjs(campaignData.scheduled_at) : null}}>
            <Title level={4}>Review Campaign Details</Title>
            <p><strong>Name:</strong> {campaignData.name || 'N/A'}</p>
            <p><strong>Subject:</strong> {campaignData.subject || 'N/A'}</p>
            <p><strong>Recipients:</strong>
                {campaignData.recipient_group?.type === 'all_contacts' ? 'All Contacts' :
                `${campaignData.recipient_group?.ids?.length || 0} specific contacts`}
            </p>
            <p><strong>Template:</strong> {selectedTemplate?.name || 'N/A'}</p>
            <hr style={{margin: '20px 0'}}/>
            <Form.Item name="scheduled_at" label="Schedule for Later (Optional)">
                <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{width: '100%'}} />
            </Form.Item>
            <Paragraph type="secondary">
                If you schedule for later, ensure your Celery worker and beat are running.
                If you leave the schedule field empty and click "Save & Schedule", it will be saved as a draft.
                To send immediately, use the "Send Now" button.
            </Paragraph>
        </Form>
      ),
    },
  ];

  if (isLoadingCampaign && isEditing) {
    return <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></Layout>;
  }
  if (campaignError && isEditing && !currentCampaignForEdit && !isLoadingCampaign) {
    return <Alert message="Error loading campaign" description={campaignError} type="error" showIcon closable onClose={() => navigate('/campaigns')} />;
  }

  return (
    <Layout>
      <Header style={{ backgroundColor: 'white', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/campaigns')} style={{marginRight: 16}}>Back to Campaigns</Button>
        <Title level={3} style={{ margin: 0 }}>{isEditing ? 'Edit Campaign' : 'Create New Campaign'}</Title>
        <div style={{width: 130}} /> {/* Spacer */}
      </Header>
      <Content style={{ margin: '24px 16px 0', paddingBottom: '24px' }}>
        <Card>
          <Steps current={currentStep -1} /* wizardStep is 1-indexed */ style={{ marginBottom: 24 }}>
            {steps.map((item, index) => <Step key={item.title} title={item.title} description={index + 1 === currentStep ? item.description : ''} />)}
          </Steps>

          {campaignError && <Alert message="Error" description={campaignError} type="error" showIcon closable style={{marginBottom: 16}}/>}

          <div className="step-content" style={{ padding: '24px', border: '1px dashed #e9e9e9', borderRadius: '2px', minHeight: 300 }}>
            {steps[currentStep - 1]?.content}
          </div>

          <div className="steps-action" style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <div>
                {currentStep > 1 && ( <Button style={{ margin: '0 8px' }} onClick={handlePrev}>Previous</Button>)}
            </div>
            <div>
                {currentStep < steps.length && ( <Button type="primary" onClick={handleNext}>Next</Button> )}
                {currentStep === steps.length && (
                    <>
                        <Button style={{ margin: '0 8px' }} type="primary" icon={<SaveOutlined />} loading={isSubmittingCampaign} onClick={() => handleSubmitCampaign('save_draft')}>
                            {isEditing ? 'Save Changes (as Draft)' : 'Save as Draft'}
                        </Button>
                        <Button style={{ margin: '0 8px' }} icon={<FieldTimeOutlined />} loading={isSubmittingCampaign} onClick={() => handleSubmitCampaign('schedule', formStep4.getFieldValue('scheduled_at'))} disabled={!formStep4.getFieldValue('scheduled_at')}>
                            Save & Schedule
                        </Button>
                        <Button type="primary" danger icon={<SendOutlined />} loading={isSubmittingCampaign} onClick={() => handleSubmitCampaign('send')}>
                            Send Now
                        </Button>
                    </>
                )}
            </div>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};

export default CampaignEditorPage;
