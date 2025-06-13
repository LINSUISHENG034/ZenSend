import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

const ContactFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData, // Contact data for editing, null for new contact
  isLoading, // Loading state for submit button
}) => {
  const [form] = Form.useForm();

  const isEditing = !!initialData;

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        // Convert custom_fields from object to Form.List compatible array
        const customFieldsArray = initialData.custom_fields
          ? Object.entries(initialData.custom_fields).map(([key, value]) => ({ fieldKey: key, fieldValue: value }))
          : [];
        form.setFieldsValue({
          ...initialData,
          custom_fields_list: customFieldsArray,
        });
      } else {
        form.resetFields();
        // Ensure custom_fields_list is initialized as an empty array for new contacts
        form.setFieldsValue({ custom_fields_list: [] });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const handleFormSubmit = (values) => {
    // Convert custom_fields_list back to an object
    const customFieldsObject = {};
    if (values.custom_fields_list) {
      values.custom_fields_list.forEach(item => {
        if (item && item.fieldKey) { // Ensure item and fieldKey are defined
          customFieldsObject[item.fieldKey] = item.fieldValue;
        }
      });
    }

    const finalValues = {
      ...values,
      custom_fields: customFieldsObject,
    };
    delete finalValues.custom_fields_list; // Remove temporary list structure

    onSubmit(finalValues);
  };

  return (
    <Modal
      title={isEditing ? 'Edit Contact' : 'Add New Contact'}
      visible={isOpen} // Antd v4 'visible', for v5 use 'open'
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" loading={isLoading} onClick={() => form.submit()}>
          {isEditing ? 'Save Changes' : 'Create Contact'}
        </Button>,
      ]}
      destroyOnClose // Reset form fields when modal is closed and re-opened
    >
      <Form
        form={form}
        layout="vertical"
        name="contactForm"
        onFinish={handleFormSubmit}
        // initialValues are set via form.setFieldsValue in useEffect for dynamic data
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true, message: 'Please input the email address!' }, { type: 'email', message: 'Please enter a valid email!' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="first_name"
          label="First Name"
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="last_name"
          label="Last Name"
        >
          <Input />
        </Form.Item>

        <Form.Item label="Custom Fields">
          <Form.List name="custom_fields_list">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'fieldKey']}
                      rules={[{ required: true, message: 'Field key is required' }]}
                      style={{width: '150px'}}
                    >
                      <Input placeholder="Field Key (e.g., Phone)" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'fieldValue']}
                      rules={[{ required: true, message: 'Field value is required' }]}
                       style={{width: '200px'}}
                    >
                      <Input placeholder="Field Value" />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Custom Field
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ContactFormModal;
